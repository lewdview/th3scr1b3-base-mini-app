'use client';

import { useEffect, useMemo, useState } from 'react';
import { SafeArea, useMiniKit } from '@coinbase/onchainkit/minikit';

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

const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'https://th3scr1b3.com';

export default function HomePage() {
  const { setFrameReady } = useMiniKit();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFrameReady();
  }, [setFrameReady]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [releaseRes, overrideRes] = await Promise.all([
          fetch('/releases.json'),
          fetch('/content-overrides.json'),
        ]);

        if (!releaseRes.ok) throw new Error('Failed to load releases');
        const data = (await releaseRes.json()) as ReleaseData;
        let overrides: ContentOverrideMap = {};

        if (overrideRes.ok) {
          overrides = (await overrideRes.json()) as ContentOverrideMap;
        }

        const stripHtml = (value: string) => {
          if (typeof window === 'undefined') return value;
          const parser = new DOMParser();
          const doc = parser.parseFromString(value, 'text/html');
          return doc.body.textContent || '';
        };

        const merged = (data.releases || []).map((release) => {
          const override = overrides[String(release.day)] || overrides[`${release.day}`];
          if (!override) return release;

          const infoPlain = override.info ? stripHtml(override.info).trim() : undefined;

          return {
            ...release,
            title: override.title || release.title,
            description: infoPlain || release.description,
            customInfo: override.info || release.customInfo,
            videoUrl: override.videoUrl || release.videoUrl,
          };
        });

        if (isMounted) {
          setReleases(merged);
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
  const recent = sorted.slice(0, 6);

  return (
    <SafeArea>
      <main>
        <div className="container">
          <section className="hero">
            <span className="tag">Now Playing</span>
            <h1>{latest ? `Day ${latest.day}: ${latest.title}` : 'Loading latest release...'}</h1>
            <p>
              {latest?.description ||
                'Tap into the latest drop from the 365-day journey. Fresh audio, new data, and daily momentum.'}
            </p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a className="button primary" href={MAIN_APP_URL} target="_blank" rel="noreferrer">
                Open Full Experience
              </a>
              {latest && (
                <a
                  className="button"
                  href={`${MAIN_APP_URL}/day/${latest.day}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Day {latest.day}
                </a>
              )}
            </div>
          </section>

          <section className="card">
            <div className="small">Recent Releases</div>
            {loading && <p style={{ marginTop: 12, color: '#8c8fa3' }}>Loading tracks...</p>}
            {!loading && recent.length === 0 && (
              <p style={{ marginTop: 12, color: '#8c8fa3' }}>No releases found.</p>
            )}
            <div className="list">
              {recent.map((release) => (
                <div key={release.id} className="list-item">
                  <div className="small">Day {release.day} · {release.date}</div>
                  <div className="value">{release.title}</div>
                  <div className="small" style={{ marginTop: 6 }}>
                    {release.mood ? `${release.mood} · ` : ''}{release.durationFormatted || '—'}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="small">Base Ready</div>
            <h2>Built for Base Mini Apps</h2>
            <p style={{ color: '#8c8fa3', marginTop: 8 }}>
              This mini app is optimized for Base App + Farcaster clients. It stays lightweight, fast,
              and focused on daily listening momentum.
            </p>
          </section>

          <div className="footer">
            Powered by OnchainKit + MiniKit on Base.
          </div>
        </div>
      </main>
    </SafeArea>
  );
}
