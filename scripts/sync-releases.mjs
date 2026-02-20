
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const SOURCE_RELEASE_PATH = path.join(PROJECT_ROOT, 'public/releases.local.json');
const SOURCE_OVERRIDES_PATH = path.join(PROJECT_ROOT, 'public/content-overrides.json');
const DEST_PATH = path.join(process.cwd(), 'public/releases.json');

// Supabase URL pattern from releases.local.json:
// https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/audio/january/01%20-%20Chunky.wav
const SUPABASE_BASE = 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready';

function transformRelease(release, overrides = {}) {
    // 1. Construct artwork URL
    // Assumption: Co-located with audio but in 'covers' folder and with .jpg extension
    let artworkUrl = null;
    if (release.storedAudioUrl) {
        artworkUrl = release.storedAudioUrl
            .replace('/audio/', '/covers/')
            .replace('.wav', '.jpg')
            .replace('.mp3', '.jpg');
    }

    // 2. Apply Overrides
    const override = overrides[String(release.day)] || overrides[release.day];
    const title = override?.title || release.title;
    const description = override?.info ? stripHtml(override.info) : release.description; // Strip HTML for description preview
    const videoUrl = override?.videoUrl || release.videoUrl;
    const customInfo = override?.info || release.customInfo;

    // 3. Minify / Clean up
    const cleanRelease = {
        id: release.id,
        day: release.day,
        date: release.date,
        title: title,
        mood: release.mood,
        description: description,
        customInfo: customInfo, // Keep full HTML info if needed
        duration: release.duration,
        durationFormatted: release.durationFormatted || formatDuration(release.duration),
        storedAudioUrl: release.storedAudioUrl,
        artworkUrl: artworkUrl,
        videoUrl: videoUrl,
        // Keep essential metadata
        bpm: release.tempo,
        key: release.key,
        genre: release.genre,
        tags: release.tags
    };

    return cleanRelease;
}

function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '');
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

async function sync() {
    console.log(`Reading source releases: ${SOURCE_RELEASE_PATH}`);
    if (!fs.existsSync(SOURCE_RELEASE_PATH)) {
        console.error(`Source file not found at ${SOURCE_RELEASE_PATH}`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(SOURCE_RELEASE_PATH, 'utf-8');
    const data = JSON.parse(rawData);
    console.log(`Found ${data.releases.length} releases in source.`);

    let overrides = {};
    if (fs.existsSync(SOURCE_OVERRIDES_PATH)) {
        console.log(`Reading overrides: ${SOURCE_OVERRIDES_PATH}`);
        const rawOverrides = fs.readFileSync(SOURCE_OVERRIDES_PATH, 'utf-8');
        overrides = JSON.parse(rawOverrides);
    } else {
        console.warn(`No overrides found at ${SOURCE_OVERRIDES_PATH}`);
    }

    const transformedReleases = data.releases.map(r => transformRelease(r, overrides));

    // Sort by day descending
    transformedReleases.sort((a, b) => b.day - a.day);

    const output = {
        generatedAt: new Date().toISOString(),
        releases: transformedReleases
    };

    console.log(`Writing ${transformedReleases.length} transformed releases with merged overrides to ${DEST_PATH}`);
    fs.writeFileSync(DEST_PATH, JSON.stringify(output, null, 2));
    console.log('Sync complete.');
}

sync().catch(err => {
    console.error('Sync failed:', err);
    process.exit(1);
});
