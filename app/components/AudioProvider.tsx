'use client';

import { createContext, useContext, useRef, useState, useCallback, useEffect, type ReactNode } from 'react';

type Release = {
    id: string;
    day: number;
    title: string;
    mood?: string;
    storedAudioUrl?: string;
};

type AudioState = {
    currentTrack: Release | null;
    isPlaying: boolean;
    progress: number;
    duration: number;
    currentTime: number;
    error: string | null;
};

type AudioContextType = AudioState & {
    play: (release: Release) => void;
    pause: () => void;
    toggle: (release: Release) => void;
    seek: (time: number) => void;
};

const AudioCtx = createContext<AudioContextType | null>(null);

export function useAudio() {
    const ctx = useContext(AudioCtx);
    if (!ctx) throw new Error('useAudio must be used within AudioProvider');
    return ctx;
}

export function AudioProvider({ children }: { children: ReactNode }) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [state, setState] = useState<AudioState>({
        currentTrack: null,
        isPlaying: false,
        progress: 0,
        duration: 0,
        currentTime: 0,
        error: null,
    });

    useEffect(() => {
        const audio = new Audio();
        audio.preload = 'metadata';
        audioRef.current = audio;

        const onTimeUpdate = () => {
            setState((prev) => ({
                ...prev,
                currentTime: audio.currentTime,
                progress: audio.duration ? (audio.currentTime / audio.duration) * 100 : 0,
            }));
        };

        const onLoadedMetadata = () => {
            setState((prev) => ({ ...prev, duration: audio.duration, error: null }));
        };

        const onEnded = () => {
            setState((prev) => ({ ...prev, isPlaying: false, progress: 0, currentTime: 0 }));
        };

        const onPlay = () => setState((prev) => ({ ...prev, isPlaying: true, error: null }));
        const onPause = () => setState((prev) => ({ ...prev, isPlaying: false }));

        const onError = (e: Event) => {
            const target = e.target as HTMLAudioElement;
            console.error('Audio error:', target.error);
            let errorMessage = 'Error playing audio';
            if (target.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                errorMessage = 'Audio source not found or format not supported';
            } else if (target.error?.code === MediaError.MEDIA_ERR_NETWORK) {
                errorMessage = 'Network error while playing audio';
            } else if (target.error?.code === MediaError.MEDIA_ERR_DECODE) {
                errorMessage = 'Error decoding audio';
            }
            setState((prev) => ({ ...prev, isPlaying: false, error: errorMessage }));
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('error', onError);

        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('error', onError);
            audio.pause();
            audio.src = '';
        };
    }, []);

    const play = useCallback((release: Release) => {
        const audio = audioRef.current;
        if (!audio || !release.storedAudioUrl) return;

        // Reset error on new play attempt
        setState(prev => ({ ...prev, error: null }));

        if (state.currentTrack?.id === release.id && state.currentTrack?.day === release.day) {
            audio.play().catch(err => {
                console.error('Playback failed:', err);
                setState(prev => ({ ...prev, isPlaying: false, error: 'Playback failed' }));
            });
            return;
        }

        audio.src = release.storedAudioUrl;
        audio.load();
        setState((prev) => ({
            ...prev,
            currentTrack: release,
            progress: 0,
            currentTime: 0,
            duration: 0,
            error: null,
        }));

        audio.play().catch(err => {
            console.error('Playback failed:', err);
            // If the error is NotSupportedError, it might be due to format or missing file
            setState(prev => ({
                ...prev,
                isPlaying: false,
                error: err.name === 'NotSupportedError' ? 'Audio format not supported or file missing' : 'Playback failed'
            }));
        });
    }, [state.currentTrack]);

    const pause = useCallback(() => {
        audioRef.current?.pause();
    }, []);

    const toggle = useCallback((release: Release) => {
        if (state.currentTrack?.id === release.id && state.currentTrack?.day === release.day && state.isPlaying) {
            pause();
        } else {
            play(release);
        }
    }, [state.currentTrack, state.isPlaying, play, pause]);

    const seek = useCallback((time: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = time;
    }, []);

    return (
        <AudioCtx.Provider value={{ ...state, play, pause, toggle, seek }}>
            {children}
        </AudioCtx.Provider>
    );
}
