'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { useAudio } from './components/AudioProvider';
import { AlbumArt } from './components/AlbumArt';
import { AudioPlayer } from './components/AudioPlayer';
import { ReleaseCard } from './components/ReleaseCard';
import { MintButton } from './components/MintButton';
import { WalletButton } from './components/WalletButton';

type Release = {
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
};

type ReleaseData = {
  releases?: Release[];
};

type ContentOverride = {
  title?: string;
  info?: string;
  videoUrl?: string;
};

type ContentOverrideMap = Record<string, ContentOverride>;

import { MAIN_APP_URL } from './constants';

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
        const res = await fetch('/releases.json');
        if (!res.ok) throw new Error('Failed to load releases');
        const data = (await res.json()) as ReleaseData;

        // Data is already merged and transformed by sync script
        if (isMounted) {
          const allReleases = data.releases || [];

          // Gating: Only show releases released on or before today
          const today = new Date();
          today.setHours(23, 59, 59, 999); // Include all of today

          const visibleReleases = allReleases.filter(release => {
            const releaseDate = new Date(release.date);
            // Parse "YYYY-MM-DD" if needed, but new Date() usually handles ISO strings well
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
    return () => { isMounted = false; };
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
          {/* Top Bar */}
          <div className="top-bar">
            <div className="app-title">th3scr1b3</div>
            <WalletButton />
          </div>

          {/* Hero */}
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

          {/* Release Grid */}
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
            Powered by OnchainKit + MiniKit on Base · <a href={MAIN_APP_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Full Experience →</a>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Player */}
      <AudioPlayer />
    </div>
  );
}
