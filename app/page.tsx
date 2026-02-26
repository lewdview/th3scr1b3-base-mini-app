'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { useAudio } from './components/AudioProvider';
import { AlbumArt } from './components/AlbumArt';
import { ReleaseCard } from './components/ReleaseCard';
import { MintButton } from './components/MintButton';
import { WalletButton } from './components/WalletButton';
import { DonationCard } from './components/DonationCard';
import { ManifestoCard } from './components/ManifestoCard';
import { MAIN_APP_URL } from './constants';
import {
  buildReleasesFromManifest,
  type ContentOverrideMap,
  type Release,
  type ReleaseManifestItem,
} from './lib/release-data';

type StartupStepKey =
  | 'manifest'
  | 'overrides'
  | 'lyrics'
  | 'releaseBuild'
  | 'mediaIndex';

type StartupStepStatus = 'pending' | 'loading' | 'done' | 'error';

type StartupStep = {
  status: StartupStepStatus;
  detail?: string;
};

const STARTUP_LABELS: Record<StartupStepKey, string> = {
  manifest: 'Release Manifest',
  overrides: 'Content Overrides',
  lyrics: 'Lyrics Index',
  releaseBuild: 'Release Build',
  mediaIndex: 'Media Index',
};

function createStartupSteps(): Record<StartupStepKey, StartupStep> {
  return {
    manifest: { status: 'pending' },
    overrides: { status: 'pending' },
    lyrics: { status: 'pending' },
    releaseBuild: { status: 'pending' },
    mediaIndex: { status: 'pending' },
  };
}

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

export default function HomePage() {
  const router = useRouter();
  const { setFrameReady } = useMiniKit();
  const { currentTrack, isPlaying, toggle } = useAudio();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [startupProgress, setStartupProgress] = useState(0);
  const [showStartupSplash, setShowStartupSplash] = useState(true);
  const [startupSteps, setStartupSteps] = useState<Record<StartupStepKey, StartupStep>>(createStartupSteps());

  const updateStartupStep = (key: StartupStepKey, status: StartupStepStatus, detail?: string) => {
    setStartupSteps((prev) => ({
      ...prev,
      [key]: { status, detail },
    }));
  };

  useEffect(() => {
    setFrameReady();
  }, [setFrameReady]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        updateStartupStep('manifest', 'loading', 'Fetching manifest');
        const manifestRes = await fetch('/release-manifest.json');
        if (!manifestRes.ok) throw new Error('Failed to load release-manifest.json');
        const manifestData = (await manifestRes.json()) as { items?: ReleaseManifestItem[] };
        if (!isMounted) return;
        updateStartupStep('manifest', 'done', `${manifestData.items?.length || 0} entries`);
        setStartupProgress(20);

        updateStartupStep('overrides', 'loading', 'Fetching overrides');
        let overrides: ContentOverrideMap = {};
        try {
          const overridesRes = await fetch('/content-overrides.json');
          if (overridesRes.ok) {
            overrides = (await overridesRes.json()) as ContentOverrideMap;
            if (isMounted) {
              updateStartupStep('overrides', 'done', `${Object.keys(overrides).length} day overrides`);
            }
          } else if (isMounted) {
            updateStartupStep('overrides', 'error', `HTTP ${overridesRes.status}`);
          }
        } catch (error) {
          console.warn('[MiniApp] content-overrides load failed', error);
          if (isMounted) updateStartupStep('overrides', 'error', 'Unavailable');
        }
        if (!isMounted) return;
        setStartupProgress(40);

        updateStartupStep('lyrics', 'loading', 'Fetching lyrics index');
        try {
          const lyricsRes = await fetch('/lyrics-by-day.json');
          if (lyricsRes.ok) {
            const lyricsData = (await lyricsRes.json()) as { mappedDays?: number; totalDays?: number };
            updateStartupStep(
              'lyrics',
              'done',
              `${lyricsData.mappedDays || 0}/${lyricsData.totalDays || 0} days`
            );
          } else {
            updateStartupStep('lyrics', 'error', `HTTP ${lyricsRes.status}`);
          }
        } catch (error) {
          console.warn('[MiniApp] lyrics index load failed', error);
          updateStartupStep('lyrics', 'error', 'Unavailable');
        }
        if (!isMounted) return;
        setStartupProgress(60);

        updateStartupStep('releaseBuild', 'loading', 'Building release list');
        const allReleases = buildReleasesFromManifest(manifestData.items || [], overrides);
        updateStartupStep('releaseBuild', 'done', `${allReleases.length} tracks prepared`);
        setStartupProgress(80);

        updateStartupStep('mediaIndex', 'loading', 'Indexing media');

        let withAudio = 0;
        let withCover = 0;
        const total = allReleases.length || 1;
        allReleases.forEach((release, index) => {
          if (release.storedAudioUrl) withAudio += 1;
          if (release.artworkUrl) withCover += 1;

          if ((index + 1) % 40 === 0 || index === total - 1) {
            const stepProgress = 80 + Math.round(((index + 1) / total) * 20);
            setStartupProgress(Math.min(99, stepProgress));
          }
        });

        updateStartupStep('mediaIndex', 'done', `${withAudio} audio · ${withCover} covers`);

        if (isMounted) {
          const today = new Date();
          today.setHours(23, 59, 59, 999);

          const visibleReleases = allReleases.filter((release) => {
            const releaseDate = new Date(release.date);
            return releaseDate <= today;
          });

          setReleases(visibleReleases);
          setStartupProgress(100);
          window.setTimeout(() => {
            if (isMounted) setShowStartupSplash(false);
          }, 420);
        }
      } catch (err) {
        console.warn('[MiniApp] Release load failed', err);
        if (isMounted) {
          updateStartupStep('manifest', 'error', 'Load failed');
          updateStartupStep('releaseBuild', 'error', 'Load failed');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const sorted = useMemo(() => {
    return [...releases].sort((a, b) => b.day - a.day);
  }, [releases]);

  const latest = sorted[0];
  const isLatestPlaying =
    currentTrack?.id === latest?.id &&
    currentTrack?.day === latest?.day &&
    isPlaying;

  return (
    <div className="safe-area">
      {showStartupSplash && (
        <div className="initial-splash">
          <div className="initial-splash-card">
            <div className="initial-splash-title">th3scr1b3</div>
            <div className="initial-splash-subtitle">Loading full archive data</div>
            <div className="initial-progress-track">
              <div className="initial-progress-fill" style={{ width: `${startupProgress}%` }} />
            </div>
            <div className="initial-progress-meta">{startupProgress}%</div>
            <div className="initial-step-list">
              {(Object.keys(STARTUP_LABELS) as StartupStepKey[]).map((key) => {
                const step = startupSteps[key];
                return (
                  <div key={key} className={`initial-step-item status-${step.status}`}>
                    <span>{STARTUP_LABELS[key]}</span>
                    <span>{step.detail || step.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <main>
        <div className="container">
          <div className="top-bar">
            <div className="app-brand">
              <div className="app-title">th3scr1b3</div>
              <div className="app-subtitle">365 Days of Light and Dark</div>
            </div>
            <WalletButton />
          </div>

          <section className="hero animate-in">
            <div className="hero-art-wrapper">
              {latest && (
                <AlbumArt day={latest.day} mood={latest.mood} artworkUrl={latest.artworkUrl} />
              )}
              <div className="hero-art-overlay" />
              {latest?.storedAudioUrl && (
                <button
                  className={`play-btn lg hero-play-btn ${isLatestPlaying ? 'playing' : ''}`}
                  onClick={() => toggle(latest)}
                  aria-label={isLatestPlaying ? 'Pause' : 'Play'}
                >
                  {isLatestPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
              )}
            </div>

            <div className="hero-content">
              <span className="tag now-playing">▶ Now Playing</span>
              <h1>{latest ? `Day ${latest.day}: ${latest.title}` : 'Loading...'}</h1>
              <p>
                {latest?.description ||
                  'Tap into the latest drop from the 365-day journey.'}
              </p>
              <div className="hero-meta">
                {latest?.mood && (
                  <span className={`tag mood-${latest.mood}`}>{latest.mood}</span>
                )}
                {latest?.durationFormatted && (
                  <span className="tag duration">{latest.durationFormatted}</span>
                )}
                {latest && <MintButton day={latest.day} />}
              </div>
            </div>
          </section>

          <div className="support-grid">
            <ManifestoCard />
            <DonationCard />
          </div>

          <div className="section-header">
            <h2>All Releases</h2>
            <span className="count">{sorted.length} tracks</span>
          </div>

          {loading && (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
              Loading tracks...
            </p>
          )}

          <div className="release-grid">
            {sorted.map((release) => (
              <ReleaseCard
                key={`${release.id}-${release.day}`}
                release={release}
                onOpenDetails={(day) => router.push(`/track/${day}`)}
              />
            ))}
          </div>

          <div className="footer">
            Powered by OnchainKit + MiniKit on Base ·{' '}
            <a href={MAIN_APP_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
              Full Experience →
            </a>
          </div>
        </div>
      </main>

    </div>
  );
}
