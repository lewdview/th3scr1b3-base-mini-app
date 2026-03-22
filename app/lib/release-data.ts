import { DAY_DURATION_FORMATTED } from './day-durations';
import { DATABASE_DAY_MOODS } from './database-day-moods';
import { LEGACY_DAY_MOODS } from './legacy-day-moods';

export type ReleaseManifestItem = {
  month: string;
  index: number;
  storageTitle: string;
  ext: string;
  audioPath?: string | null;
  coverPath?: string | null;
  mood?: 'light' | 'dark' | null;
};

export type ContentOverride = {
  title?: string;
  info?: string;
  videoUrl?: string;
  mood?: 'light' | 'dark';
};

export type ContentOverrideMap = Record<string, ContentOverride>;

export type Release = {
  id: string;
  day: number;
  date: string;
  title: string;
  mood?: string;
  description?: string;
  durationFormatted?: string;
  customInfo?: string;
  videoUrl?: string;
  storedAudioUrl?: string;
  artworkUrl?: string;
  audioSources?: string[];
  artworkSources?: string[];
};

export const DEFAULT_STORAGE_BASE_URL =
  process.env.NEXT_PUBLIC_RELEASE_STORAGE_BASE_URL?.trim() ||
  'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready';

const PROJECT_YEAR = 2026;

const MONTH_OFFSETS: Record<string, number> = {
  january: 0,
  february: 31,
  march: 59,
  april: 90,
  may: 120,
  june: 151,
  july: 181,
  august: 212,
  september: 243,
  october: 273,
  november: 304,
  december: 334,
};

function stripHtml(html?: string) {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
}

function toAbsoluteStorageUrl(storagePath?: string | null, baseUrl = DEFAULT_STORAGE_BASE_URL) {
  if (!storagePath) return null;
  const normalizedPath = storagePath.replace(/^\/+/, '');
  return `${baseUrl}/${normalizedPath}`;
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const output: string[] = [];

  values.forEach((value) => {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    output.push(normalized);
  });

  return output;
}

function capitalizeFirst(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function toCompactTitle(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, '');
}

function toPascalTitle(value: string) {
  const words = value.match(/[a-zA-Z0-9]+/g) || [];
  return words
    .map((word) => capitalizeFirst(word.toLowerCase()))
    .join('');
}

function buildStorageTitleCandidates(...values: Array<string | null | undefined>) {
  const variants: Array<string | null> = [];

  values.forEach((value) => {
    const trimmed = value?.trim();
    if (!trimmed) return;

    const compact = toCompactTitle(trimmed);
    const compactLower = compact.toLowerCase();
    const pascal = toPascalTitle(trimmed);

    variants.push(trimmed);
    variants.push(compactLower || null);
    variants.push(compactLower ? capitalizeFirst(compactLower) : null);
    variants.push(pascal || null);
  });

  return uniqueNonEmpty(variants);
}

function toDerivedAudioPath(item: ReleaseManifestItem) {
  const ext = item.ext || 'wav';
  const relDay = String(item.index).padStart(2, '0');
  const encodedFile = encodeURIComponent(`${relDay} - ${item.storageTitle}.${ext}`);
  return `audio/${item.month}/${encodedFile}`;
}

function toDerivedAudioPathForTitle(item: ReleaseManifestItem, title: string) {
  const ext = item.ext || 'wav';
  const relDay = String(item.index).padStart(2, '0');
  const encodedFile = encodeURIComponent(`${relDay} - ${title}.${ext}`);
  return `audio/${item.month}/${encodedFile}`;
}

function toDerivedCoverPath(audioPath?: string | null) {
  if (!audioPath) return null;
  const normalizedPath = audioPath.replace(/^\/+/, '');
  const coverPath = normalizedPath.startsWith('audio/')
    ? `covers/${normalizedPath.slice('audio/'.length)}`
    : normalizedPath.replace('/audio/', '/covers/');

  return coverPath.replace(/\.[^./]+$/, '.png');
}

function buildAudioPathCandidates(item: ReleaseManifestItem, overrideTitle?: string) {
  const explicitAudioPath = item.audioPath?.replace(/^\/+/, '') || null;
  const titleCandidates = buildStorageTitleCandidates(item.storageTitle, overrideTitle);
  const derivedAudioPaths = titleCandidates.map((title) => toDerivedAudioPathForTitle(item, title));

  return uniqueNonEmpty([explicitAudioPath, ...derivedAudioPaths]);
}

function buildCoverPathCandidates(item: ReleaseManifestItem, overrideTitle?: string) {
  const explicitCoverPath = item.coverPath?.replace(/^\/+/, '') || null;
  const audioPathCandidates = buildAudioPathCandidates(item, overrideTitle);
  const derivedCoverPaths = audioPathCandidates.map((audioPath) => toDerivedCoverPath(audioPath));

  return uniqueNonEmpty([explicitCoverPath, ...derivedCoverPaths]);
}

function getAbsoluteDay(item: ReleaseManifestItem) {
  const monthOffset = MONTH_OFFSETS[item.month.toLowerCase()] ?? 0;
  return monthOffset + Number(item.index);
}

function getIsoDate(day: number) {
  const utcDate = new Date(Date.UTC(PROJECT_YEAR, 0, day));
  return utcDate.toISOString().slice(0, 10);
}

function isValidMood(value?: string | null): value is 'light' | 'dark' {
  return value === 'light' || value === 'dark';
}

function inferMoodFromText(value: string): 'light' | 'dark' | null {
  const normalized = value.toLowerCase();

  // Respect explicit mood words first when present in title/info text.
  if (/\blight\b/.test(normalized)) return 'light';
  if (/\bdark\b/.test(normalized)) return 'dark';

  return null;
}

function resolveMood(
  day: number,
  moodText: string,
  manifestMood?: string | null,
  overrideMood?: string
): 'light' | 'dark' {
  if (isValidMood(overrideMood)) return overrideMood;
  if (isValidMood(manifestMood)) return manifestMood;

  const inferredMood = inferMoodFromText(moodText);
  if (isValidMood(inferredMood)) return inferredMood;

  const databaseMood = DATABASE_DAY_MOODS[day];
  if (isValidMood(databaseMood)) return databaseMood;

  const legacyMood = LEGACY_DAY_MOODS[day];
  if (isValidMood(legacyMood)) return legacyMood;

  return day % 2 === 0 ? 'light' : 'dark';
}

function buildReleaseFromManifestItem(
  item: ReleaseManifestItem,
  overrides: ContentOverrideMap,
  storageBaseUrl: string
): Release {
  const day = getAbsoluteDay(item);
  const override = overrides[String(day)] || overrides[day as unknown as keyof ContentOverrideMap];
  const audioPathCandidates = buildAudioPathCandidates(item, override?.title);
  const coverPathCandidates = buildCoverPathCandidates(item, override?.title);
  const audioPath = audioPathCandidates[0] || toDerivedAudioPath(item);
  const coverPath = coverPathCandidates[0] || toDerivedCoverPath(audioPath);
  const audioSources = audioPathCandidates
    .map((path) => toAbsoluteStorageUrl(path, storageBaseUrl))
    .filter((value): value is string => Boolean(value));
  const artworkSources = coverPathCandidates
    .map((path) => toAbsoluteStorageUrl(path, storageBaseUrl))
    .filter((value): value is string => Boolean(value));

  const description = override?.info
    ? stripHtml(override.info)
    : `Day ${day} from the 365 Days of Light and Dark collection.`;
  const moodText = [override?.title, item.storageTitle, description].filter(Boolean).join(' ');
  const mood = resolveMood(day, moodText, item.mood, override?.mood);

  return {
    id: `${item.month}-${item.index}`,
    day,
    date: getIsoDate(day),
    title: override?.title || item.storageTitle,
    mood,
    description,
    durationFormatted: DAY_DURATION_FORMATTED[day],
    customInfo: override?.info || undefined,
    videoUrl: override?.videoUrl || undefined,
    storedAudioUrl: toAbsoluteStorageUrl(audioPath, storageBaseUrl) || undefined,
    artworkUrl: toAbsoluteStorageUrl(coverPath, storageBaseUrl) || undefined,
    audioSources: audioSources.length > 0 ? audioSources : undefined,
    artworkSources: artworkSources.length > 0 ? artworkSources : undefined,
  };
}

export function buildReleasesFromManifest(
  manifestItems: ReleaseManifestItem[],
  overrides: ContentOverrideMap = {},
  storageBaseUrl = DEFAULT_STORAGE_BASE_URL
): Release[] {
  return manifestItems
    .map((item) => buildReleaseFromManifestItem(item, overrides, storageBaseUrl))
    .sort((a, b) => a.day - b.day);
}
