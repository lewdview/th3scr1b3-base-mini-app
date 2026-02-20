'use client';

type AlbumArtProps = {
    day: number;
    mood?: string;
    artworkUrl?: string;
    className?: string;
};

export function AlbumArt({ day, mood = 'dark', artworkUrl, className = '' }: AlbumArtProps) {
    const moodClass = mood === 'light' ? 'mood-light' : 'mood-dark';

    return (
        <div className={`album-art ${className}`}>
            {artworkUrl ? (
                <img src={artworkUrl} alt={`Day ${day}`} className="album-art-image" loading="lazy" />
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
