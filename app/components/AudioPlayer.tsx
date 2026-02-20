'use client';

import { useAudio } from './AudioProvider';
import { AlbumArt } from './AlbumArt';

function formatTime(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

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

export function AudioPlayer() {
    const { currentTrack, isPlaying, progress, currentTime, duration, toggle, seek, error } = useAudio();

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        seek(ratio * duration);
    };

    return (
        <div className={`player-bar ${currentTrack ? 'visible' : ''}`}>
            <div className="progress-container" onClick={handleSeek}>
                <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="player-bar-art">
                {currentTrack && (
                    <AlbumArt day={currentTrack.day} mood={currentTrack.mood} />
                )}
            </div>

            <div className="player-bar-info">
                <div className="player-bar-title">
                    {error ? (
                        <span className="error-text">{error}</span>
                    ) : (
                        currentTrack?.title || ''
                    )}
                </div>
                <div className="player-bar-day">
                    {currentTrack ? `Day ${currentTrack.day}` : ''}
                </div>
            </div>

            {currentTrack && (
                <button
                    className={`play-btn sm ${isPlaying ? 'playing' : ''}`}
                    onClick={() => toggle(currentTrack)}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
            )}

            <span className="player-time">
                {formatTime(currentTime)} / {formatTime(duration)}
            </span>
        </div>
    );
}
