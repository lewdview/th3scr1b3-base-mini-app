'use client';

import { useAudio } from './AudioProvider';
import { AlbumArt } from './AlbumArt';
import { MintButton } from './MintButton';

type Release = {
    id: string;
    day: number;
    date: string;
    title: string;
    mood?: string;
    description?: string;
    durationFormatted?: string;
    storedAudioUrl?: string;
    artworkUrl?: string;
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

export function ReleaseCard({ release }: { release: Release }) {
    const { currentTrack, isPlaying, toggle } = useAudio();
    const isCurrentlyPlaying =
        currentTrack?.id === release.id &&
        currentTrack?.day === release.day &&
        isPlaying;
    const hasAudio = !!release.storedAudioUrl;

    return (
        <div className="release-card animate-in">
            <div className="release-card-art">
                <AlbumArt
                    day={release.day}
                    mood={release.mood}
                    artworkUrl={release.artworkUrl}
                />
                <button
                    className={`play-btn sm ${isCurrentlyPlaying ? 'playing' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggle(release);
                    }}
                    disabled={!hasAudio}
                    aria-label={isCurrentlyPlaying ? 'Pause' : 'Play'}
                >
                    {isCurrentlyPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
            </div>

            <div className="release-card-info">
                <div className="card-title" title={release.title}>{release.title}</div>
                <div className="card-meta">
                    <span>Day {release.day}</span>
                    {release.mood && <span>· {release.mood}</span>}
                    {release.durationFormatted && <span>· {release.durationFormatted}</span>}
                </div>
            </div>

            <div className="release-card-bottom">
                <span className="tag mood-${release.mood || 'dark'}" style={{
                    background: release.mood === 'light' ? 'rgba(255,214,10,0.1)' : 'rgba(255,45,85,0.1)',
                    color: release.mood === 'light' ? 'var(--accent-2)' : 'var(--accent)',
                }}>
                    {release.mood || 'dark'}
                </span>
                <MintButton day={release.day} />
            </div>
        </div>
    );
}
