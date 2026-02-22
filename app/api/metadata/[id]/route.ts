import fs from 'fs/promises';
import path from 'path';
import {
  buildReleasesFromManifest,
  type ContentOverrideMap,
  type Release,
  type ReleaseManifestItem,
} from '../../../lib/release-data';
import { MAIN_APP_URL } from '../../../constants';

type ManifestData = {
  items?: ReleaseManifestItem[];
};

const MANIFEST_PATH = path.join(process.cwd(), 'public/release-manifest.json');
const OVERRIDES_PATH = path.join(process.cwd(), 'public/content-overrides.json');

let cachedReleases: Release[] | null = null;

export const runtime = 'nodejs';

function stripHtml(html?: string) {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
}

function parseTokenId(rawId: string) {
  const id = decodeURIComponent(rawId).trim();
  if (!id) return null;

  if (/^\d+$/.test(id)) {
    const parsed = Number(id);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  if (/^(0x)?[0-9a-fA-F]+$/.test(id)) {
    const prefixed = id.startsWith('0x') ? id : `0x${id}`;
    try {
      const parsed = Number(BigInt(prefixed));
      return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
    } catch {
      return null;
    }
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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const tokenId = parseTokenId(params.id);
  if (!tokenId) {
    return Response.json({ error: 'Invalid token id' }, { status: 400 });
  }

  const releases = await readReleases();
  const release = releases.find((entry) => Number(entry.day) === tokenId);
  if (!release) {
    return Response.json({ error: 'Token metadata not found' }, { status: 404 });
  }

  const requestUrl = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_URL || requestUrl.origin;

  const descriptionText =
    stripHtml(release.customInfo) ||
    release.description ||
    `Day ${tokenId} from the 365 Days of Light and Dark collection.`;

  return Response.json(
    {
      name: `Day ${tokenId}: ${release.title || 'Untitled'}`,
      description: descriptionText,
      image: release.artworkUrl || `${appUrl}/icon.svg`,
      animation_url: release.storedAudioUrl || undefined,
      external_url: `${MAIN_APP_URL}?day=${tokenId}`,
      attributes: [
        { trait_type: 'Day', value: tokenId, display_type: 'number' },
        { trait_type: 'Mood', value: release.mood || 'unknown' },
        { trait_type: 'Duration', value: release.durationFormatted || 'unknown' },
      ],
      properties: {
        video_url: release.videoUrl || null,
      },
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    }
  );
}
