'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { useAudio } from './components/AudioProvider';
import { AlbumArt } from './components/AlbumArt';
import { AudioPlayer } from './components/AudioPlayer';
import { ReleaseCard } from './components/ReleaseCard';
import { MintButton } from './components/MintButton';
import { WalletButton } from './components/WalletButton';
import { MAIN_APP_URL } from './constants';
import {
  buildReleasesFromManifest,
  type ContentOverrideMap,
  type Release,
  type ReleaseManifestItem,
} from './lib/release-data';

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
  const { setFrameReady } = useMiniKit();
  const { currentTrack, isPlaying, toggle } = useAudio();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFrameReady();
  }, [setFrameReady]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const manifestRes = await fetch('/release-manifest.json');
        if (!manifestRes.ok) throw new Error('Failed to load release-manifest.json');

        const manifestData = (await manifestRes.json()) as { items?: ReleaseManifestItem[] };

        let overrides: ContentOverrideMap = {};
        try {
          const overridesRes = await fetch('/content-overrides.json');
          if (overridesRes.ok) {
            overrides = (await overridesRes.json()) as ContentOverrideMap;
          }
        } catch (error) {
          console.warn('[MiniApp] content-overrides load failed', error);
        }

        const allReleases = buildReleasesFromManifest(manifestData.items || [], overrides);

        if (isMounted) {
          const today = new Date();
          today.setHours(23, 59, 59, 999);

          const visibleReleases = allReleases.filter((release) => {
            const releaseDate = new Date(release.date);
            return releaseDate <= today;
          });

          setReleases(visibleReleases);
        }
      } catch (err) {
        console.warn('[MiniApp] Release load failed', err);
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
              <ReleaseCard key={`${release.id}-${release.day}`} release={release} />
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

      <AudioPlayer />
    </div>
  );
}
