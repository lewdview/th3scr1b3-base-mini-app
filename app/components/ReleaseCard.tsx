'use client';

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
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

type ReleaseCardProps = {
    release: Release;
    onOpenDetails?: (day: number) => void;
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

export function ReleaseCard({ release, onOpenDetails }: ReleaseCardProps) {
    const { currentTrack, isPlaying, toggle } = useAudio();
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

    const openDetails = () => {
        onOpenDetails?.(release.day);
    };

    const clearHoldTimer = () => {
        if (!holdTimerRef.current) return;
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!onOpenDetails) return;
        const target = event.target as HTMLElement;
        if (target.closest('button,a,input,textarea,label')) return;

        pointerStartRef.current = { x: event.clientX, y: event.clientY };
        clearHoldTimer();
        holdTimerRef.current = setTimeout(() => {
            openDetails();
        }, 550);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!pointerStartRef.current || !holdTimerRef.current) return;
        const deltaX = Math.abs(event.clientX - pointerStartRef.current.x);
        const deltaY = Math.abs(event.clientY - pointerStartRef.current.y);
        if (deltaX > 8 || deltaY > 8) {
            clearHoldTimer();
            pointerStartRef.current = null;
        }
    };

    const handlePointerEnd = () => {
        clearHoldTimer();
        pointerStartRef.current = null;
    };

    const isCurrentlyPlaying =
        currentTrack?.id === release.id &&
        currentTrack?.day === release.day &&
        isPlaying;
    const hasAudio = !!release.storedAudioUrl;

    return (
        <div
            className="release-card animate-in"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerLeave={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onContextMenu={(event) => {
                if (!onOpenDetails) return;
                event.preventDefault();
                openDetails();
            }}
        >
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
                {onOpenDetails && <div className="card-hold-hint">Hold for details</div>}
            </div>

            <div className="release-card-bottom">
                <span className={`tag mood-${release.mood || 'dark'}`} style={{
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
