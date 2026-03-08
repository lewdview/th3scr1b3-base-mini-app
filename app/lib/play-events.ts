const DEFAULT_SUPABASE_URL = 'https://pznmptudgicrmljjafex.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bm1wdHVkZ2ljcm1samphZmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMDE4ODUsImV4cCI6MjA3OTg3Nzg4NX0.syu1bbr9OJ5LxCnTrybLVgsjac4UOkFVdAHuvhKMY2g';

const PLAY_SESSION_KEY = 'th3scr1b3_play_session_id_v1';

export type RecordUniversalPlayInput = {
  releaseId: string;
  day?: number;
  source?: string;
  platform?: string;
  positionSeconds?: number;
};

export type UniversalPlayCounter = {
  globalTotal: number;
  globalToday: number;
  globalLast7d: number;
  releaseTotal: number;
  releaseToday: number;
  releaseLast7d: number;
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  return { url, anonKey };
}

function getOrCreateSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.localStorage.getItem(PLAY_SESSION_KEY);
    if (existing) return existing;

    const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    window.localStorage.setItem(PLAY_SESSION_KEY, generated);
    return generated;
  } catch {
    return null;
  }
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeCounter(value: unknown): UniversalPlayCounter {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    globalTotal: toNumber(row.global_total),
    globalToday: toNumber(row.global_today),
    globalLast7d: toNumber(row.global_last_7d),
    releaseTotal: toNumber(row.release_total),
    releaseToday: toNumber(row.release_today),
    releaseLast7d: toNumber(row.release_last_7d),
  };
}

export async function recordUniversalPlayEvent({
  releaseId,
  day,
  source,
  platform,
  positionSeconds,
}: RecordUniversalPlayInput): Promise<void> {
  const cleanedReleaseId = releaseId.trim();
  if (!cleanedReleaseId) return;

  const { url, anonKey } = getSupabaseConfig();

  const response = await fetch(`${url}/rest/v1/rpc/record_play_event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      p_release_id: cleanedReleaseId,
      p_day: typeof day === 'number' ? day : null,
      p_source: source || 'mini_audio_player',
      p_platform: platform || 'base_mini_app',
      p_session_id: getOrCreateSessionId(),
      p_position_seconds: typeof positionSeconds === 'number' ? positionSeconds : null,
      p_referrer: typeof document === 'undefined' ? null : document.referrer || null,
      p_user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent || null,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`record_play_event failed (${response.status}): ${text}`);
  }
}

export async function fetchUniversalPlayCounter(releaseId?: string, day?: number): Promise<UniversalPlayCounter | null> {
  const { url, anonKey } = getSupabaseConfig();

  const response = await fetch(`${url}/rest/v1/rpc/get_play_counter_public`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      p_release_id: releaseId ?? null,
      p_day: typeof day === 'number' ? day : null,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`get_play_counter_public failed (${response.status}): ${text}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload)) {
    return normalizeCounter(payload[0]);
  }

  return normalizeCounter(payload);
}
