import fs from 'fs/promises';
import path from 'path';
import {
  buildReleasesFromManifest,
  type ContentOverrideMap,
  type Release,
  type ReleaseManifestItem,
} from '../../../lib/release-data';

type ManifestData = {
  items?: ReleaseManifestItem[];
};

type LyricsApiResponse = {
  day: number;
  source: 'database' | 'overrides' | 'none';
  lyrics: string | null;
  loadedAt: string;
};

const MANIFEST_PATH = path.join(process.cwd(), 'public/release-manifest.json');
const OVERRIDES_PATH = path.join(process.cwd(), 'public/content-overrides.json');
const LYRICS_BY_DAY_PATH = path.join(process.cwd(), 'public/lyrics-by-day.json');

let cachedReleases: Release[] | null = null;
let cachedLyricsByDay: Record<string, { lyrics?: string; title?: string }> | null = null;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseDay(rawDay: string) {
  const value = decodeURIComponent(rawDay).trim();
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function stripHtml(html?: string) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeLyricsFromPayload(payload: unknown, depth = 0): string | null {
  if (depth > 4 || payload == null) return null;

  if (typeof payload === 'string') {
    const normalized = payload.trim();
    return normalized || null;
  }

  if (Array.isArray(payload)) {
    const values = payload
      .map((item) => normalizeLyricsFromPayload(item, depth + 1))
      .filter((item): item is string => Boolean(item));

    if (values.length === 0) return null;
    return values.join('\n').trim() || null;
  }

  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const priorityKeys = [
      'lyrics',
      'lyric',
      'text',
      'body',
      'poetry',
      'poem',
      'content',
      'lines',
      'data',
      'result',
      'record',
    ];

    for (const key of priorityKeys) {
      if (!(key in record)) continue;
      const value = normalizeLyricsFromPayload(record[key], depth + 1);
      if (value) return value;
    }
  }

  return null;
}

function extractFallbackLyrics(release: Release, day: number) {
  const fromCustomInfo = stripHtml(release.customInfo);
  if (fromCustomInfo) return fromCustomInfo;

  const normalizedDescription = (release.description || '').trim();
  if (
    normalizedDescription &&
    !normalizedDescription.startsWith(`Day ${day} from the 365 Days of Light and Dark collection.`)
  ) {
    return normalizedDescription;
  }

  return null;
}

async function readJsonIfExists<T>(filePath: string, fallback: T): Promise<T> {
  try {
    await fs.access(filePath);
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readReleases() {
  if (cachedReleases) return cachedReleases;

  const manifestRaw = await fs.readFile(MANIFEST_PATH, 'utf-8');
  const manifestData = JSON.parse(manifestRaw) as ManifestData;
  const overrides = await readJsonIfExists<ContentOverrideMap>(OVERRIDES_PATH, {});

  cachedReleases = buildReleasesFromManifest(manifestData.items || [], overrides);
  return cachedReleases;
}

async function readLyricsByDay() {
  if (cachedLyricsByDay) return cachedLyricsByDay;

  try {
    const raw = await fs.readFile(LYRICS_BY_DAY_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as { items?: Record<string, { lyrics?: string; title?: string }> };
    cachedLyricsByDay = parsed.items || {};
    return cachedLyricsByDay;
  } catch {
    cachedLyricsByDay = {};
    return cachedLyricsByDay;
  }
}

function buildLyricsDatabaseUrl(day: number) {
  const template = process.env.LYRICS_DATABASE_ENDPOINT?.trim();
  if (!template) return null;

  if (template.includes('{day}')) {
    return template.replace('{day}', String(day));
  }

  return `${template.replace(/\/+$/, '')}/${day}`;
}

async function fetchLyricsFromDatabase(day: number) {
  const requestUrl = buildLyricsDatabaseUrl(day);
  if (!requestUrl) return null;

  const token = process.env.LYRICS_DATABASE_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers.apikey = token;
    headers['x-api-key'] = token;
  }

  try {
    const response = await fetch(requestUrl, {
      headers,
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as unknown;
      return normalizeLyricsFromPayload(payload);
    }

    const payload = await response.text();
    return normalizeLyricsFromPayload(payload);
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { day: string } }
) {
  const day = parseDay(params.day);
  if (!day) {
    return Response.json({ error: 'Invalid day' }, { status: 400 });
  }

  const releases = await readReleases();
  const release = releases.find((entry) => entry.day === day);
  if (!release) {
    return Response.json({ error: 'Track not found' }, { status: 404 });
  }

  const lyricsByDay = await readLyricsByDay();
  const localLyrics = lyricsByDay[String(day)]?.lyrics?.trim();
  if (localLyrics) {
    const payload: LyricsApiResponse = {
      day,
      source: 'database',
      lyrics: localLyrics,
      loadedAt: new Date().toISOString(),
    };
    return Response.json(payload, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  const dbLyrics = await fetchLyricsFromDatabase(day);
  if (dbLyrics) {
    const payload: LyricsApiResponse = {
      day,
      source: 'database',
      lyrics: dbLyrics,
      loadedAt: new Date().toISOString(),
    };
    return Response.json(payload, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  const fallbackLyrics = extractFallbackLyrics(release, day);
  const payload: LyricsApiResponse = {
    day,
    source: fallbackLyrics ? 'overrides' : 'none',
    lyrics: fallbackLyrics || null,
    loadedAt: new Date().toISOString(),
  };

  return Response.json(payload, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
