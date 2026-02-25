'use client';

export type TrackLoadMetrics = {
  manifestMs?: number;
  lyricsMs?: number;
  coverMs?: number;
  audioMs?: number;
  totalMs?: number;
};

export type TrackStatsEntry = {
  day: number;
  viewCount: number;
  playCount: number;
  paidCommentCount: number;
  selectedTheme: string;
  lastViewedAt: string;
  updatedAt: string;
  loadMetrics?: TrackLoadMetrics;
};

type TrackStatsMap = Record<string, TrackStatsEntry>;

const TRACK_STATS_KEY = 'th3scr1b3_track_stats_v1';

function isBrowser() {
  return typeof window !== 'undefined';
}

function readAllStats(): TrackStatsMap {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(TRACK_STATS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TrackStatsMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllStats(stats: TrackStatsMap) {
  if (!isBrowser()) return;
  window.localStorage.setItem(TRACK_STATS_KEY, JSON.stringify(stats));
}

function withTrackStats(day: number, updater: (entry: TrackStatsEntry) => TrackStatsEntry) {
  if (!Number.isFinite(day) || day <= 0) return null;

  const now = new Date().toISOString();
  const all = readAllStats();
  const key = String(day);
  const existing: TrackStatsEntry = all[key] || {
    day,
    viewCount: 0,
    playCount: 0,
    paidCommentCount: 0,
    selectedTheme: 'noir',
    lastViewedAt: now,
    updatedAt: now,
  };

  const next = updater(existing);
  next.updatedAt = now;
  all[key] = next;
  writeAllStats(all);
  return next;
}

export function readTrackStatsEntry(day: number) {
  if (!Number.isFinite(day) || day <= 0) return null;
  return readAllStats()[String(day)] || null;
}

export function recordTrackView(day: number) {
  return withTrackStats(day, (entry) => ({
    ...entry,
    viewCount: entry.viewCount + 1,
    lastViewedAt: new Date().toISOString(),
  }));
}

export function recordTrackPlay(day: number) {
  return withTrackStats(day, (entry) => ({
    ...entry,
    playCount: entry.playCount + 1,
  }));
}

export function recordTrackComment(day: number) {
  return withTrackStats(day, (entry) => ({
    ...entry,
    paidCommentCount: entry.paidCommentCount + 1,
  }));
}

export function recordTrackTheme(day: number, theme: string) {
  return withTrackStats(day, (entry) => ({
    ...entry,
    selectedTheme: theme,
  }));
}

export function recordTrackLoadMetrics(day: number, loadMetrics: TrackLoadMetrics) {
  return withTrackStats(day, (entry) => ({
    ...entry,
    loadMetrics,
  }));
}

export function exportTrackStatsJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: 'th3scr1b3-base-mini-app',
    version: 1,
    tracks: Object.values(readAllStats()).sort((a, b) => a.day - b.day),
  };

  return JSON.stringify(payload, null, 2);
}
