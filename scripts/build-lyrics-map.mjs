#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function ensureString(value, fallback = '') {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

function normalizeSegments(rawSegments) {
  if (!Array.isArray(rawSegments)) return [];

  return rawSegments
    .map((segment) => {
      if (!segment || typeof segment !== 'object') return null;
      const start = Number(segment.start);
      const end = Number(segment.end);
      const text = ensureString(segment.text).trim();
      if (!Number.isFinite(start) || !Number.isFinite(end) || !text) return null;
      if (end <= start) return null;

      return {
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
        text,
      };
    })
    .filter(Boolean);
}

function parseJson(raw, filePath) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : 'parse failed'}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const dbPath = path.resolve(cwd, args.db || '');
  const manifestPath = path.resolve(cwd, args.manifest || 'public/release-manifest.json');
  const outPath = path.resolve(cwd, args.out || 'public/lyrics-by-day.json');

  if (!args.db) {
    throw new Error('Missing required --db path (database-complete export JSON).');
  }

  const [dbRaw, manifestRaw] = await Promise.all([
    fs.readFile(dbPath, 'utf8'),
    fs.readFile(manifestPath, 'utf8'),
  ]);

  const databasePayload = parseJson(dbRaw, dbPath);
  const manifestPayload = parseJson(manifestRaw, manifestPath);

  const songs = Array.isArray(databasePayload?.songs) ? databasePayload.songs : [];
  const manifestItems = Array.isArray(manifestPayload?.items) ? manifestPayload.items : [];

  if (songs.length === 0) {
    throw new Error('No songs[] found in database export.');
  }
  if (manifestItems.length === 0) {
    throw new Error('No items[] found in release manifest.');
  }

  const songIndexByTitle = new Map();
  songs.forEach((song, index) => {
    const title = ensureString(song?.title);
    const fileStem = ensureString(song?.fileName).replace(/\.[^./]+$/, '');

    [title, fileStem].forEach((candidate) => {
      const key = normalizeTitle(candidate);
      if (!key || songIndexByTitle.has(key)) return;
      songIndexByTitle.set(key, index);
    });
  });

  const items = {};
  let fallbackMatches = 0;
  let exactMatches = 0;
  let missingLyrics = 0;

  manifestItems.forEach((item, position) => {
    const day = position + 1;
    const storageTitle = ensureString(item?.storageTitle);
    const normalized = normalizeTitle(storageTitle);

    let songIndex = songIndexByTitle.get(normalized);
    if (songIndex == null && position < songs.length) {
      songIndex = position;
      fallbackMatches += 1;
    } else if (songIndex != null) {
      exactMatches += 1;
    }

    if (songIndex == null) return;

    const song = songs[songIndex];
    const lyrics = ensureString(song?.lyrics).trim();
    if (!lyrics) {
      missingLyrics += 1;
      return;
    }

    const segments = normalizeSegments(song?.lyricsSegments);

    items[String(day)] = {
      title: ensureString(song?.title, storageTitle || `Day ${day}`),
      lyrics,
      segments,
      sourceSongId: ensureString(song?.id),
      sourceFileName: ensureString(song?.fileName),
    };
  });

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: path.basename(dbPath),
    totalDays: manifestItems.length,
    mappedDays: Object.keys(items).length,
    matchStats: {
      exactMatches,
      fallbackMatches,
      missingLyrics,
    },
    items,
  };

  await fs.writeFile(outPath, JSON.stringify(payload, null, 2));

  const bytes = Buffer.byteLength(JSON.stringify(payload));
  console.log(`Wrote ${outPath}`);
  console.log(`Mapped days: ${payload.mappedDays}/${payload.totalDays}`);
  console.log(`Matches: exact=${exactMatches}, fallback=${fallbackMatches}, missingLyrics=${missingLyrics}`);
  console.log(`Approx JSON bytes: ${bytes}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
