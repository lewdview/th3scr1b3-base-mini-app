'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useAccount,
  useChainId,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { base } from 'wagmi/chains';
import { isAddress, parseEther } from 'viem';
import { AlbumArt } from '../../components/AlbumArt';
import { useAudio } from '../../components/AudioProvider';
import { MintButton } from '../../components/MintButton';
import {
  COMMENT_FEE_ETH,
  COMMENT_RECEIVER,
  DAILY_MUSE_CONTRACT_ADDRESS,
  MAIN_APP_URL,
  MINT_PRICE_ETH,
} from '../../constants';
import {
  buildReleasesFromManifest,
  type ContentOverrideMap,
  type Release,
  type ReleaseManifestItem,
} from '../../lib/release-data';
import {
  exportTrackStatsJson,
  readTrackStatsEntry,
  recordTrackComment,
  recordTrackLoadMetrics,
  recordTrackPlay,
  recordTrackTheme,
  recordTrackView,
  type TrackLoadMetrics,
  type TrackStatsEntry,
} from '../../lib/track-stats';
import { fetchUniversalPlayCounter, type UniversalPlayCounter } from '../../lib/play-events';
import {
  APP_THEME_OPTIONS,
  APP_THEME_STORAGE_KEY,
  DEFAULT_APP_THEME_ID,
  isAppThemeId,
} from '../../lib/app-theme';

type LocalComment = {
  id: string;
  day: number;
  author: string;
  message: string;
  txHash: `0x${string}`;
  amountEth: string;
  createdAt: string;
};

type LyricsSource = 'database' | 'overrides' | 'none';

type LyricsSegment = {
  start: number;
  end: number;
  text: string;
};

type LyricsApiResponse = {
  day: number;
  source?: LyricsSource;
  lyrics?: string | null;
  segments?: LyricsSegment[];
};

type LoadStepKey = 'manifest' | 'lyrics' | 'cover' | 'audio';
type LoadStepStatus = 'pending' | 'loading' | 'ready' | 'error' | 'skipped';

type LoadStep = {
  status: LoadStepStatus;
  detail?: string;
  startedAt?: number;
  finishedAt?: number;
};

type LoadStepState = Record<LoadStepKey, LoadStep>;

const COMMENT_STORAGE_KEY = 'th3scr1b3_paid_comments_v1';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const LOAD_STEP_LABELS: Record<LoadStepKey, string> = {
  manifest: 'Manifest',
  lyrics: 'Lyrics',
  cover: 'Cover',
  audio: 'Audio',
};

const LOAD_STEP_STATUS_TEXT: Record<LoadStepStatus, string> = {
  pending: 'Pending',
  loading: 'Loading',
  ready: 'Ready',
  error: 'Failed',
  skipped: 'Skipped',
};

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

function createInitialLoadSteps(): LoadStepState {
  return {
    manifest: { status: 'pending' },
    lyrics: { status: 'pending' },
    cover: { status: 'pending' },
    audio: { status: 'pending' },
  };
}

function formatMs(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '0.0s';
  return `${(ms / 1000).toFixed(1)}s`;
}

function getStepDuration(step: LoadStep, nowMs: number) {
  if (!step.startedAt) return null;
  const end = step.finishedAt || nowMs;
  return Math.max(0, end - step.startedAt);
}

function toErrorMessage(error: unknown) {
  if (!error) return 'Request failed.';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const shortMessage = (error as { shortMessage?: unknown }).shortMessage;
    if (typeof shortMessage === 'string' && shortMessage.length > 0) return shortMessage;
  }
  return 'Request failed.';
}

function shortenAddress(address?: string) {
  if (!address) return '';
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function readStoredComments() {
  if (typeof window === 'undefined') return [] as LocalComment[];
  try {
    const raw = window.localStorage.getItem(COMMENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalComment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredComments(comments: LocalComment[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COMMENT_STORAGE_KEY, JSON.stringify(comments));
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (!isFinite(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatPlayCount(value: number | null | undefined) {
  if (!Number.isFinite(value)) return '0';
  return Number(value).toLocaleString();
}

function toLoadMetrics(loadSteps: LoadStepState, totalMs: number): TrackLoadMetrics {
  const manifestMs = getStepDuration(loadSteps.manifest, Date.now()) || undefined;
  const lyricsMs = getStepDuration(loadSteps.lyrics, Date.now()) || undefined;
  const coverMs = getStepDuration(loadSteps.cover, Date.now()) || undefined;
  const audioMs = getStepDuration(loadSteps.audio, Date.now()) || undefined;

  return {
    manifestMs,
    lyricsMs,
    coverMs,
    audioMs,
    totalMs,
  };
}

function formatLyricsSource(source: LyricsSource) {
  if (source === 'database') return 'Database lyrics';
  if (source === 'overrides') return 'Fallback lyrics';
  return 'No lyrics source';
}

export default function TrackDetailsPage() {
  const params = useParams<{ day: string }>();
  const day = Number(params.day);
  const { currentTrack, isPlaying, currentTime, toggle } = useAudio();

  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  const [lyrics, setLyrics] = useState('');
  const [lyricsSegments, setLyricsSegments] = useState<LyricsSegment[]>([]);
  const [lyricsSource, setLyricsSource] = useState<LyricsSource>('none');
  const [lyricsError, setLyricsError] = useState<string | null>(null);
  const [appTheme, setAppTheme] = useState(DEFAULT_APP_THEME_ID);

  const [loadSteps, setLoadSteps] = useState<LoadStepState>(createInitialLoadSteps());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showLoadPanel, setShowLoadPanel] = useState(true);

  const [comments, setComments] = useState<LocalComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [pendingComment, setPendingComment] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const [statsSnapshot, setStatsSnapshot] = useState<TrackStatsEntry | null>(null);
  const [statsMessage, setStatsMessage] = useState<string | null>(null);
  const [universalCounter, setUniversalCounter] = useState<UniversalPlayCounter | null>(null);
  const [universalCounterError, setUniversalCounterError] = useState<string | null>(null);
  const [isLoadingUniversalCounter, setIsLoadingUniversalCounter] = useState(false);

  const pageStartRef = useRef(Date.now());
  const metricsRecordedRef = useRef(false);
  const lyricListRef = useRef<HTMLDivElement | null>(null);
  const lyricRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { sendTransactionAsync, isPending: isSendingCommentTx } = useSendTransaction();

  const {
    isLoading: isConfirmingComment,
    isSuccess: isCommentPaid,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    chainId: base.id,
    hash: txHash,
  });

  const refreshStats = useCallback(() => {
    if (!Number.isFinite(day) || day <= 0) {
      setStatsSnapshot(null);
      return;
    }
    setStatsSnapshot(readTrackStatsEntry(day));
  }, [day]);

  const setLoadStep = useCallback((key: LoadStepKey, status: LoadStepStatus, detail?: string) => {
    setLoadSteps((prev) => {
      const existing = prev[key];
      const now = Date.now();
      const startedAt =
        status === 'loading'
          ? existing.startedAt || now
          : existing.startedAt || (status === 'pending' ? undefined : now);
      const finishedAt =
        status === 'ready' || status === 'error' || status === 'skipped'
          ? now
          : undefined;

      return {
        ...prev,
        [key]: {
          status,
          detail,
          startedAt,
          finishedAt,
        },
      };
    });
  }, []);

  useEffect(() => {
    pageStartRef.current = Date.now();
    metricsRecordedRef.current = false;
    setElapsedMs(0);
    setShowLoadPanel(true);
    setLoadSteps(createInitialLoadSteps());
    setStatsMessage(null);
  }, [day]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - pageStartRef.current);
    }, 150);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!Number.isFinite(day) || day <= 0) return;

    let isMounted = true;
    setLoading(true);
    setLoadStep('manifest', 'loading', 'Loading release catalog');

    recordTrackView(day);
    refreshStats();

    const load = async () => {
      try {
        const manifestRes = await fetch('/release-manifest.json');
        if (!manifestRes.ok) throw new Error('Failed to load release manifest.');

        const manifestData = (await manifestRes.json()) as { items?: ReleaseManifestItem[] };

        let overrides: ContentOverrideMap = {};
        try {
          const overridesRes = await fetch('/content-overrides.json');
          if (overridesRes.ok) {
            overrides = (await overridesRes.json()) as ContentOverrideMap;
          }
        } catch (error) {
          console.warn('[TrackDetails] content-overrides load failed', error);
        }

        const built = buildReleasesFromManifest(manifestData.items || [], overrides);
        if (isMounted) {
          setReleases(built);
          setLoadStep('manifest', 'ready', `Loaded ${built.length} tracks`);
        }
      } catch (error) {
        if (isMounted) {
          setLoadStep('manifest', 'error', toErrorMessage(error));
        }
        console.warn('[TrackDetails] release load failed', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [day, refreshStats, setLoadStep]);

  useEffect(() => {
    if (!Number.isFinite(day) || day <= 0) return;

    let isMounted = true;
    setLyrics('');
    setLyricsSegments([]);
    setLyricsSource('none');
    setLyricsError(null);
    setLoadStep('lyrics', 'loading', 'Fetching lyrics');

    const loadLyrics = async () => {
      try {
        const response = await fetch(`/api/lyrics/${day}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Lyrics request failed (${response.status})`);
        }

        const payload = (await response.json()) as LyricsApiResponse;
        const nextLyrics = (payload.lyrics || '').trim();
        const source = payload.source || 'none';
        const nextSegments = Array.isArray(payload.segments)
          ? payload.segments
              .map((segment) => ({
                start: Number(segment.start),
                end: Number(segment.end),
                text: String(segment.text || '').trim(),
              }))
              .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start && segment.text)
          : [];

        if (!isMounted) return;

        setLyrics(nextLyrics);
        setLyricsSegments(nextSegments);
        setLyricsSource(source);

        if (nextLyrics) {
          const lines = nextLyrics.split(/\n+/).filter(Boolean).length;
          setLoadStep('lyrics', 'ready', `${lines} lines ready`);
        } else {
          setLoadStep('lyrics', 'skipped', 'No lyrics found');
        }
      } catch (error) {
        if (!isMounted) return;
        setLyricsError(toErrorMessage(error));
        setLoadStep('lyrics', 'error', toErrorMessage(error));
      }
    };

    void loadLyrics();
    return () => {
      isMounted = false;
    };
  }, [day, setLoadStep]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    const nextTheme = isAppThemeId(stored) ? stored : DEFAULT_APP_THEME_ID;
    setAppTheme(nextTheme);
    document.body.dataset.appTheme = nextTheme;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(APP_THEME_STORAGE_KEY, appTheme);
    document.body.dataset.appTheme = appTheme;

    if (Number.isFinite(day) && day > 0) {
      recordTrackTheme(day, appTheme);
      refreshStats();
    }
  }, [appTheme, day, refreshStats]);

  useEffect(() => {
    if (!Number.isFinite(day) || day <= 0) return;
    const stored = readStoredComments().filter((entry) => entry.day === day);
    setComments(stored.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
  }, [day]);

  useEffect(() => {
    if (!receiptError) return;
    setCommentError(toErrorMessage(receiptError));
  }, [receiptError]);

  useEffect(() => {
    if (!isCommentPaid || !pendingComment || !txHash || !Number.isFinite(day) || day <= 0) return;

    const entry: LocalComment = {
      id: `${txHash}-${Date.now()}`,
      day,
      author: address || 'unknown',
      message: pendingComment,
      txHash,
      amountEth: COMMENT_FEE_ETH,
      createdAt: new Date().toISOString(),
    };

    const updated = [entry, ...readStoredComments()].slice(0, 300);
    writeStoredComments(updated);
    setComments(updated.filter((item) => item.day === day));
    setPendingComment(null);
    setTxHash(undefined);
    setCommentError(null);

    recordTrackComment(day);
    refreshStats();
  }, [address, day, isCommentPaid, pendingComment, refreshStats, txHash]);

  const release = useMemo(
    () => releases.find((item) => item.day === day),
    [releases, day]
  );

  useEffect(() => {
    if (!release) {
      setUniversalCounter(null);
      setUniversalCounterError(null);
      setIsLoadingUniversalCounter(false);
      return;
    }

    let cancelled = false;
    setUniversalCounterError(null);
    setIsLoadingUniversalCounter(true);

    void fetchUniversalPlayCounter(release.id, release.day)
      .then((payload) => {
        if (cancelled) return;
        setUniversalCounter(payload);
      })
      .catch((error) => {
        if (cancelled) return;
        setUniversalCounterError(toErrorMessage(error));
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingUniversalCounter(false);
      });

    return () => {
      cancelled = true;
    };
  }, [release?.day, release?.id]);

  const isCurrentTrackInView = Boolean(
    release &&
      currentTrack?.id === release.id &&
      currentTrack?.day === release.day
  );

  const activeLyricSegmentIndex = useMemo(() => {
    if (!isCurrentTrackInView || lyricsSegments.length === 0) return -1;
    return lyricsSegments.findIndex((segment) => currentTime >= segment.start && currentTime < segment.end);
  }, [currentTime, isCurrentTrackInView, lyricsSegments]);

  useEffect(() => {
    if (activeLyricSegmentIndex < 0) return;
    const container = lyricListRef.current;
    const node = lyricRefs.current[activeLyricSegmentIndex];
    if (!container || !node) return;

    const containerRect = container.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const edgePadding = 12;
    const isAbove = nodeRect.top < containerRect.top + edgePadding;
    const isBelow = nodeRect.bottom > containerRect.bottom - edgePadding;

    if (!isAbove && !isBelow) return;

    const targetTop = node.offsetTop - container.clientHeight / 2 + node.offsetHeight / 2;
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const nextTop = Math.min(maxTop, Math.max(0, targetTop));

    container.scrollTo({ top: nextTop, behavior: 'smooth' });
  }, [activeLyricSegmentIndex]);

  useEffect(() => {
    if (loading || release) return;
    setLoadStep('cover', 'skipped', 'No track cover');
    setLoadStep('audio', 'skipped', 'No track audio');
  }, [loading, release, setLoadStep]);

  useEffect(() => {
    if (!release) return;

    if (!release.artworkUrl) {
      setLoadStep('cover', 'skipped', 'No cover URL');
      return;
    }

    let cancelled = false;
    setLoadStep('cover', 'loading', 'Loading cover art');

    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      setLoadStep('cover', 'ready', 'Cover loaded');
    };
    image.onerror = () => {
      if (cancelled) return;
      setLoadStep('cover', 'error', 'Cover load failed');
    };
    image.src = release.artworkUrl;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [release?.artworkUrl, release?.day, setLoadStep]);

  useEffect(() => {
    if (!release) return;

    if (!release.storedAudioUrl) {
      setLoadStep('audio', 'skipped', 'No audio URL');
      return;
    }

    let cancelled = false;
    setLoadStep('audio', 'loading', 'Loading audio metadata');

    const audio = new Audio();
    audio.preload = 'metadata';

    const onLoaded = () => {
      if (cancelled) return;
      setLoadStep('audio', 'ready', 'Audio ready');
    };

    const onError = () => {
      if (cancelled) return;
      setLoadStep('audio', 'error', 'Audio load failed');
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('canplaythrough', onLoaded);
    audio.addEventListener('error', onError);
    audio.src = release.storedAudioUrl;
    audio.load();

    return () => {
      cancelled = true;
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('canplaythrough', onLoaded);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.src = '';
    };
  }, [release?.storedAudioUrl, release?.day, setLoadStep]);

  const loadStatus = useMemo(() => {
    const now = Date.now();
    const keys = Object.keys(LOAD_STEP_LABELS) as LoadStepKey[];
    const items = keys.map((key) => {
      const step = loadSteps[key];
      return {
        key,
        label: LOAD_STEP_LABELS[key],
        status: step.status,
        detail: step.detail,
        durationMs: getStepDuration(step, now),
      };
    });

    const hasPending = items.some((item) => item.status === 'pending' || item.status === 'loading');
    const hasErrors = items.some((item) => item.status === 'error');

    return {
      items,
      isLoading: hasPending,
      hasErrors,
      isDone: !hasPending,
    };
  }, [loadSteps, elapsedMs]);

  useEffect(() => {
    if (!loadStatus.isDone) {
      setShowLoadPanel(true);
      return;
    }

    if (!metricsRecordedRef.current && Number.isFinite(day) && day > 0) {
      const totalMs = Date.now() - pageStartRef.current;
      recordTrackLoadMetrics(day, toLoadMetrics(loadSteps, totalMs));
      refreshStats();
      metricsRecordedRef.current = true;
    }

    const timer = window.setTimeout(() => setShowLoadPanel(false), 900);
    return () => window.clearTimeout(timer);
  }, [day, loadStatus.isDone, loadSteps, refreshStats]);

  const isTrackPlaying = Boolean(
    release &&
      currentTrack?.id === release.id &&
      currentTrack?.day === release.day &&
      isPlaying
  );

  const hasCommentReceiver =
    isAddress(COMMENT_RECEIVER) && COMMENT_RECEIVER !== ZERO_ADDRESS;
  const isCommentBusy = isSwitchingChain || isSendingCommentTx || isConfirmingComment;
  const commentCount = comments.length;

  const handleToggleTrack = () => {
    if (!release) return;

    if (!isTrackPlaying && Number.isFinite(day) && day > 0) {
      recordTrackPlay(day);
      refreshStats();
    }

    toggle(release);

    if (!isTrackPlaying) {
      window.setTimeout(() => {
        void fetchUniversalPlayCounter(release.id, release.day)
          .then((payload) => {
            setUniversalCounter(payload);
            setUniversalCounterError(null);
          })
          .catch(() => {});
      }, 1400);
    }
  };

  const submitComment = async () => {
    if (isCommentBusy) return;
    setCommentError(null);

    try {
      if (!release) throw new Error('Track not loaded yet.');
      if (!hasCommentReceiver) {
        throw new Error('Set NEXT_PUBLIC_COMMENT_RECEIVER to enable paid comments.');
      }
      if (!isConnected) throw new Error('Connect wallet to comment.');

      const message = commentText.trim();
      if (!message) throw new Error('Enter a comment.');
      if (message.length > 280) throw new Error('Comment must be 280 characters or less.');

      if (chainId !== base.id) {
        await switchChainAsync({ chainId: base.id });
      }

      const hash = await sendTransactionAsync({
        to: COMMENT_RECEIVER as `0x${string}`,
        value: parseEther(COMMENT_FEE_ETH),
      });

      setPendingComment(message);
      setCommentText('');
      setTxHash(hash);
    } catch (error) {
      setCommentError(toErrorMessage(error));
    }
  };

  const exportStats = () => {
    try {
      const payload = exportTrackStatsJson();
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const datePart = new Date().toISOString().slice(0, 10);

      link.href = url;
      link.download = `th3scr1b3-miniapp-stats-${datePart}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setStatsMessage('Stats exported. Import this JSON into the main site.');
    } catch (error) {
      setStatsMessage(toErrorMessage(error));
    }
  };

  useEffect(() => {
    if (!statsMessage) return;
    const timer = window.setTimeout(() => setStatsMessage(null), 4200);
    return () => window.clearTimeout(timer);
  }, [statsMessage]);

  if (!Number.isFinite(day) || day <= 0) {
    return (
      <main className={`track-page app-theme-${appTheme}`}>
        <div className="container track-page-inner">
          <Link href="/" className="track-back-link">← Back to releases</Link>
          <section className="support-card">
            <div className="support-card-title">Track Not Found</div>
            <p className="support-card-copy">Invalid track day in URL.</p>
          </section>
        </div>
      </main>
    );
  }

  const lyricLineCount = lyrics ? lyrics.split(/\n+/).filter(Boolean).length : 0;

  return (
    <main className={`track-page app-theme-${appTheme}`}>
      <div className="container track-page-inner">
        <Link href="/" className="track-back-link">← Back to releases</Link>

        {showLoadPanel && (
          <section className="support-card load-status-card animate-in">
            <div className="load-status-head">
              <div className="support-card-title">Loading Track Assets</div>
              <div className="load-status-runtime">{formatMs(elapsedMs)}</div>
            </div>
            <p className="support-card-copy">
              {loadStatus.isLoading
                ? 'Checking and loading cover, lyrics, and audio in real time.'
                : loadStatus.hasErrors
                ? 'Load completed with warnings. Some assets may be missing.'
                : 'All assets are loaded and ready.'}
            </p>

            <div className="load-status-list">
              {loadStatus.items.map((item) => (
                <div key={item.key} className={`load-status-item status-${item.status}`}>
                  <span className="load-status-dot" />
                  <span className="load-status-label">{item.label}</span>
                  <span className="load-status-meta">
                    {item.detail || LOAD_STEP_STATUS_TEXT[item.status]}
                    {item.durationMs != null ? ` · ${formatMs(item.durationMs)}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="support-card theme-control-card animate-in">
          <div>
            <div className="support-card-title">App Theme</div>
            <p className="support-card-copy">
              Applies across app containers, not just lyrics.
            </p>
          </div>
          <label className="app-theme-picker" htmlFor="app-theme-select">
            <span className="sr-only">App theme</span>
            <select
              id="app-theme-select"
              value={appTheme}
              onChange={(event) => {
                if (isAppThemeId(event.target.value)) {
                  setAppTheme(event.target.value);
                }
              }}
            >
              {APP_THEME_OPTIONS.map((theme) => (
                <option key={theme.id} value={theme.id}>{theme.label}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="support-card poetry-card animate-in">
          <div className="poetry-card-head">
            <div>
              <div className="support-card-title">Poetry in Motion</div>
              <div className="poetry-source">
                {formatLyricsSource(lyricsSource)}
                {lyricLineCount > 0 ? ` · ${lyricLineCount} lines` : ''}
                {lyricsSegments.length > 0 ? ' · Karaoke ready' : ''}
              </div>
            </div>
          </div>

          {lyricsError ? (
            <p className="support-card-copy wallet-status-error">{lyricsError}</p>
          ) : lyricsSegments.length > 0 ? (
            <div className="poetry-karaoke-list" ref={lyricListRef}>
              {lyricsSegments.map((segment, index) => {
                const isActive = index === activeLyricSegmentIndex;
                const isDone = isCurrentTrackInView && currentTime >= segment.end;
                return (
                  <div
                    key={`${segment.start}-${segment.end}-${index}`}
                    ref={(node) => {
                      lyricRefs.current[index] = node;
                    }}
                    className={`poetry-karaoke-line ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                  >
                    {segment.text}
                  </div>
                );
              })}
            </div>
          ) : lyrics ? (
            <pre className="poetry-text">{lyrics}</pre>
          ) : (
            <p className="support-card-copy">No lyrics available for this day yet.</p>
          )}
        </section>

        {loading && (
          <section className="support-card">
            <div className="support-card-title">Loading</div>
            <p className="support-card-copy">Loading track details...</p>
          </section>
        )}

        {!loading && !release && (
          <section className="support-card">
            <div className="support-card-title">Not Available</div>
            <p className="support-card-copy">
              Day {day} is not available yet. Go back to the release grid for available drops.
            </p>
          </section>
        )}

        {release && (
          <>
            <section className="track-hero support-card animate-in">
              <div className="track-hero-art">
                <AlbumArt day={release.day} mood={release.mood} artworkUrl={release.artworkUrl} />
              </div>
              <div className="track-hero-copy">
                <div className="track-hero-top">
                  <span className={`tag mood-${release.mood || 'dark'}`}>{release.mood || 'dark'}</span>
                  {release.durationFormatted && <span className="tag duration">{release.durationFormatted}</span>}
                </div>
                <h1>Day {release.day}: {release.title}</h1>
                <p>{release.description}</p>
                {release.storedAudioUrl && (
                  <button
                    type="button"
                    className={`play-btn track-play-btn ${isTrackPlaying ? 'playing' : ''}`}
                    onClick={handleToggleTrack}
                    aria-label={isTrackPlaying ? 'Pause track' : 'Play track'}
                  >
                    {isTrackPlaying ? <PauseIcon /> : <PlayIcon />}
                  </button>
                )}
              </div>
            </section>

            <div className="track-details-grid">
              <section className="support-card animate-in">
                <div className="support-card-title">Mint Details</div>
                <div className="track-info-list">
                  <div><span>Token ID</span><strong>{release.day}</strong></div>
                  <div><span>Mint Price</span><strong>{MINT_PRICE_ETH} ETH</strong></div>
                  <div><span>Contract</span><strong>{shortenAddress(DAILY_MUSE_CONTRACT_ADDRESS)}</strong></div>
                  <div><span>Main App</span><strong><a href={MAIN_APP_URL} target="_blank" rel="noreferrer">Open</a></strong></div>
                </div>
                <div className="track-actions-row">
                  <MintButton day={release.day} />
                  <a
                    className="track-link-btn"
                    href={`https://basescan.org/address/${DAILY_MUSE_CONTRACT_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Contract ↗
                  </a>
                </div>
              </section>

              <section className="support-card animate-in">
                <div className="support-card-title">Paid Comments</div>
                <p className="support-card-copy">
                  Post a comment by paying {COMMENT_FEE_ETH} ETH on Base. The transaction hash is attached to each comment.
                </p>

                <div className="track-info-list">
                  <div><span>Comment Fee</span><strong>{COMMENT_FEE_ETH} ETH</strong></div>
                  <div><span>Receiver</span><strong>{shortenAddress(COMMENT_RECEIVER)}</strong></div>
                  <div><span>Comments</span><strong>{commentCount}</strong></div>
                </div>

                <div className="comment-compose">
                  <textarea
                    className="comment-input"
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    maxLength={280}
                    placeholder="Write your comment (max 280 chars)"
                    enterKeyHint="send"
                  />
                  <button
                    type="button"
                    className="comment-submit-btn"
                    onClick={() => {
                      void submitComment();
                    }}
                    disabled={!hasCommentReceiver || !isConnected || isCommentBusy}
                  >
                    {isCommentBusy ? 'Processing...' : `Post (${COMMENT_FEE_ETH} ETH)`}
                  </button>
                </div>

                <div className={`support-card-helper ${commentError ? 'wallet-status-error' : ''}`}>
                  {commentError || (
                    hasCommentReceiver
                      ? (isConnected ? 'Wallet connected. Comment posts after transaction confirmation.' : 'Connect wallet to post comments.')
                      : 'Set NEXT_PUBLIC_COMMENT_RECEIVER to enable comments.'
                  )}
                </div>

                <div className="comment-list">
                  {commentCount === 0 && (
                    <div className="comment-empty">No comments yet for this day.</div>
                  )}
                  {comments.map((comment) => (
                    <article key={comment.id} className="comment-item">
                      <div className="comment-item-top">
                        <span>{shortenAddress(comment.author)}</span>
                        <span>{formatDate(comment.createdAt)}</span>
                      </div>
                      <p>{comment.message}</p>
                      <a
                        href={`https://basescan.org/tx/${comment.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Tx: {shortenAddress(comment.txHash)}
                      </a>
                    </article>
                  ))}
                </div>
              </section>

              <section className="support-card animate-in">
                <div className="support-card-title">Session Stats</div>
                <div className="track-info-list">
                  <div><span>Views (local)</span><strong>{statsSnapshot?.viewCount ?? 0}</strong></div>
                  <div><span>Play Taps (local)</span><strong>{statsSnapshot?.playCount ?? 0}</strong></div>
                  <div><span>Paid Comments (local)</span><strong>{statsSnapshot?.paidCommentCount ?? 0}</strong></div>
                  <div><span>Theme (local)</span><strong>{statsSnapshot?.selectedTheme || appTheme}</strong></div>
                  <div><span>Last Seen (local)</span><strong>{statsSnapshot?.lastViewedAt ? formatDate(statsSnapshot.lastViewedAt) : 'Now'}</strong></div>
                </div>

                <button type="button" className="track-export-btn" onClick={exportStats}>
                  Export Stats JSON
                </button>

                <div className="support-card-title" style={{ marginTop: '16px' }}>Universal Plays</div>
                {isLoadingUniversalCounter ? (
                  <div className="support-card-helper">Loading universal play counters...</div>
                ) : universalCounterError ? (
                  <div className="support-card-helper wallet-status-error">{universalCounterError}</div>
                ) : (
                  <div className="track-info-list">
                    <div><span>Song Plays (all-time)</span><strong>{formatPlayCount(universalCounter?.releaseTotal)}</strong></div>
                    <div><span>Song Plays (today)</span><strong>{formatPlayCount(universalCounter?.releaseToday)}</strong></div>
                    <div><span>Song Plays (7d)</span><strong>{formatPlayCount(universalCounter?.releaseLast7d)}</strong></div>
                    <div><span>Global Plays (all-time)</span><strong>{formatPlayCount(universalCounter?.globalTotal)}</strong></div>
                    <div><span>Global Plays (today)</span><strong>{formatPlayCount(universalCounter?.globalToday)}</strong></div>
                    <div><span>Global Plays (7d)</span><strong>{formatPlayCount(universalCounter?.globalLast7d)}</strong></div>
                  </div>
                )}

                <div className="support-card-helper">
                  {statsMessage || 'Local session stats stay on this device and are separate from universal counts.'}
                </div>
              </section>
            </div>

            {release.customInfo && (
              <section className="support-card track-info-html animate-in">
                <div className="support-card-title">Track Notes</div>
                <div dangerouslySetInnerHTML={{ __html: release.customInfo }} />
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
