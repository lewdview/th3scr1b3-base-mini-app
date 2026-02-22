
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const SOURCE_RELEASE_PATH = path.join(PROJECT_ROOT, 'public/releases.local.json');
const SOURCE_OVERRIDES_PATH = path.join(PROJECT_ROOT, 'public/content-overrides.json');
const SOURCE_MANIFEST_PATH = path.join(PROJECT_ROOT, 'public/release-manifest.json');
const DEST_PATH = path.join(process.cwd(), 'public/releases.json');

// Override with RELEASE_STORAGE_BASE_URL if needed.
const STORAGE_BASE_URL =
    process.env.RELEASE_STORAGE_BASE_URL ||
    'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready';

function toAbsoluteStorageUrl(storagePath) {
    if (!storagePath) return null;
    const normalizedPath = String(storagePath).replace(/^\/+/, '');
    return `${STORAGE_BASE_URL}/${normalizedPath}`;
}

function toDerivedCoverPath(audioPath) {
    if (!audioPath) return null;
    const normalizedPath = String(audioPath).replace(/^\/+/, '');
    const coverPath = normalizedPath.startsWith('audio/')
        ? `covers/${normalizedPath.slice('audio/'.length)}`
        : normalizedPath.replace('/audio/', '/covers/');

    return coverPath.replace(/\.[^./]+$/, '.png');
}

function buildManifestByDay(manifestItems = []) {
    const manifestByDay = new Map();
    manifestItems.forEach((item, idx) => {
        manifestByDay.set(idx + 1, item);
    });
    return manifestByDay;
}

function transformRelease(release, manifestByDay, overrides = {}) {
    const day = Number(release.day);
    const manifestItem = manifestByDay.get(day);

    const manifestAudioPath = manifestItem?.audioPath || null;
    const manifestCoverPath = manifestItem?.coverPath || toDerivedCoverPath(manifestAudioPath);

    // Use release-manifest as source of truth for storage URLs.
    const storedAudioUrl = manifestAudioPath
        ? toAbsoluteStorageUrl(manifestAudioPath)
        : release.storedAudioUrl || null;
    const artworkUrl = manifestCoverPath
        ? toAbsoluteStorageUrl(manifestCoverPath)
        : null;

    // Use content-overrides for editorial info.
    const override = overrides[String(day)] || overrides[day];
    const title = override?.title || release.title || manifestItem?.storageTitle;
    const description = override?.info ? stripHtml(override.info) : release.description;
    const customInfo = override?.info || release.customInfo || null;
    const videoUrl = override?.videoUrl || release.videoUrl || null;

    return {
        id: release.id,
        day,
        date: release.date,
        title,
        mood: release.mood,
        description,
        customInfo,
        duration: release.duration,
        durationFormatted: release.durationFormatted || formatDuration(release.duration),
        storedAudioUrl,
        artworkUrl,
        videoUrl,
        // Keep essential metadata
        bpm: release.tempo,
        key: release.key,
        genre: release.genre,
        tags: release.tags,
        manifestAudioPath
    };
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

    let manifestItems = [];
    if (fs.existsSync(SOURCE_MANIFEST_PATH)) {
        console.log(`Reading release manifest: ${SOURCE_MANIFEST_PATH}`);
        const rawManifest = fs.readFileSync(SOURCE_MANIFEST_PATH, 'utf-8');
        const manifest = JSON.parse(rawManifest);
        manifestItems = Array.isArray(manifest.items) ? manifest.items : [];
        console.log(`Found ${manifestItems.length} manifest items.`);
    } else {
        console.warn(`No release manifest found at ${SOURCE_MANIFEST_PATH}`);
    }

    const manifestByDay = buildManifestByDay(manifestItems);
    const transformedReleases = data.releases.map(r => transformRelease(r, manifestByDay, overrides));

    // Sort by day descending
    transformedReleases.sort((a, b) => b.day - a.day);

    const output = {
        generatedAt: new Date().toISOString(),
        storageBaseUrl: STORAGE_BASE_URL,
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
