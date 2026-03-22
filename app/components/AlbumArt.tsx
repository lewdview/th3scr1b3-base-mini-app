'use client';

import { useEffect, useMemo, useState } from 'react';

type AlbumArtProps = {
    day: number;
    mood?: string;
    artworkUrl?: string;
    artworkSources?: string[];
    className?: string;
};

export function AlbumArt({ day, mood = 'dark', artworkUrl, artworkSources, className = '' }: AlbumArtProps) {
    const moodClass = mood === 'light' ? 'mood-light' : 'mood-dark';
    const sources = useMemo(
        () => Array.from(new Set([artworkUrl, ...(artworkSources || [])].filter(Boolean))) as string[],
        [artworkUrl, artworkSources]
    );
    const [activeSourceIndex, setActiveSourceIndex] = useState(0);

    useEffect(() => {
        setActiveSourceIndex(0);
    }, [sources]);

    const activeArtworkUrl = sources[activeSourceIndex];

    return (
        <div className={`album-art ${className}`}>
            {activeArtworkUrl ? (
                <img
                    src={activeArtworkUrl}
                    alt={`Day ${day}`}
                    className="album-art-image"
                    loading="lazy"
                    onError={() => {
                        setActiveSourceIndex((current) =>
                            current < sources.length - 1 ? current + 1 : current
                        );
                    }}
                />
            ) : (
                <>
                    <div className={`album-art-gradient ${moodClass}`} />
                    <div className="album-art-noise" />
                </>
            )}
            <div className="album-art-day">{String(day).padStart(3, '0')}</div>
        </div>
    );
}
