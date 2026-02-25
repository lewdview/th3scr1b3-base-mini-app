import json
import re
import urllib.parse
from pathlib import Path

MAIN_ROOT = Path("/Volumes/extremeUno/th3scr1b3-365-warp")
DB_EXPORT_PATH = Path("/Users/studio/Downloads/database-complete-1771749929478.json")

USE_STORE_PATH = MAIN_ROOT / "src/store/useStore.ts"
DATABASE_MAP_PATH = MAIN_ROOT / "src/services/databaseDayMoods.ts"
LEGACY_MAP_PATH = MAIN_ROOT / "src/services/legacyDayMoods.ts"
MOOD_RESOLVER_PATH = MAIN_ROOT / "src/services/moodResolver.ts"
LEGACY_RELEASES_PATH = MAIN_ROOT / "old_nfo/public/releases.json"
MANIFEST_PATH = MAIN_ROOT / "public/release-manifest.json"


MONTH_OFFSETS = {
    "january": 0,
    "february": 31,
    "march": 59,
    "april": 90,
    "may": 120,
    "june": 151,
    "july": 181,
    "august": 212,
    "september": 243,
    "october": 273,
    "november": 304,
    "december": 334,
}


POSITIVE_WEIGHTS = {
    "joy": 0.6,
    "hope": 0.45,
    "hopeful": 0.5,
    "upbeat": 0.6,
    "cheerful": 0.6,
    "playful": 0.4,
    "love": 0.35,
    "romantic": 0.35,
    "gratitude": 0.35,
    "confident": 0.25,
    "confidence": 0.25,
    "determination": 0.2,
    "connection": 0.2,
    "excitement": 0.4,
    "uplifting": 0.45,
    "desire": 0.1,
}


NEGATIVE_WEIGHTS = {
    "dark": 0.8,
    "sadness": 0.55,
    "melancholic": 0.5,
    "frustration": 0.45,
    "frustrated": 0.45,
    "anger": 0.55,
    "fear": 0.45,
    "despair": 0.65,
    "despairing": 0.65,
    "regret": 0.35,
    "confusion": 0.2,
    "conflicted": 0.2,
    "hopelessness": 0.7,
    "anxious": 0.25,
    "defiant": 0.15,
    "intense": 0.1,
}


def normalize_match_key(raw: str | None) -> str:
    value = (raw or "").lower()
    value = urllib.parse.unquote(value)
    value = re.sub(r"\.[a-z0-9]{2,4}$", "", value)
    value = re.sub(r"^\d+\s*[-_ ]\s*", "", value)
    value = re.sub(
        r"\b(landr|mastered|mixdown|vbr|vocal|afterlife|th3scr1b3|feat|ft|remix|balanced|medium|warm|low|high|newm|sat|normal\d*|mastering|with|sunroof|at|pct)\b",
        " ",
        value,
    )
    value = re.sub(r"[^a-z0-9]+", "", value)
    return value


def classify_song_mood(song: dict) -> str:
    score = 0.0

    valence = song.get("valence")
    if isinstance(valence, (int, float)):
        score += (float(valence) - 0.5) * 2.0

    moods = song.get("mood")
    if isinstance(moods, list):
        for mood_token in moods:
            if not isinstance(mood_token, str):
                continue
            token = mood_token.strip().lower()
            score += POSITIVE_WEIGHTS.get(token, 0.0)
            score -= NEGATIVE_WEIGHTS.get(token, 0.0)

    return "light" if score >= 0 else "dark"


def build_database_day_moods() -> dict[int, str]:
    raw_database = json.loads(DB_EXPORT_PATH.read_text())
    songs = raw_database.get("songs", [])
    manifest_items = json.loads(MANIFEST_PATH.read_text()).get("items", [])

    song_index: dict[str, dict] = {}
    for song in songs:
        keys = {
            normalize_match_key(song.get("title")),
            normalize_match_key(song.get("fileName")),
        }
        for key in keys:
            if key and key not in song_index:
                song_index[key] = song

    day_moods: dict[int, str] = {}
    for item in manifest_items:
        month = str(item.get("month", "")).lower()
        index = int(item.get("index", 0))
        day = MONTH_OFFSETS.get(month, 0) + index

        audio_path = item.get("audioPath") or ""
        audio_file = audio_path.split("/")[-1] if audio_path else ""
        candidates = [
            normalize_match_key(item.get("storageTitle")),
            normalize_match_key(audio_file),
        ]

        matched_song = None
        for candidate in candidates:
            if candidate in song_index:
                matched_song = song_index[candidate]
                break

        if matched_song:
            day_moods[day] = classify_song_mood(matched_song)

    return day_moods


def build_legacy_day_moods() -> dict[int, str]:
    releases = json.loads(LEGACY_RELEASES_PATH.read_text()).get("releases", [])
    result: dict[int, str] = {}
    for release in releases:
        day = release.get("day")
        mood = release.get("mood")
        if isinstance(day, int) and mood in ("light", "dark") and day not in result:
            result[day] = mood
    return result


def write_day_map_ts(path: Path, const_name: str, title_comment: str, day_map: dict[int, str]) -> None:
    lines = [
        title_comment,
        f'export const {const_name}: Record<number, "light" | "dark"> = {{',
    ]
    for day in sorted(day_map):
        lines.append(f"  {day}: '{day_map[day]}',")
    lines.extend(["};", ""])
    path.write_text("\n".join(lines))


def write_mood_resolver() -> None:
    content = """import type { Release } from '../types';
import { DATABASE_DAY_MOODS } from './databaseDayMoods';
import { LEGACY_DAY_MOODS } from './legacyDayMoods';

type Mood = 'light' | 'dark';

const LIGHT_KEYWORDS = [
  'alright',
  'feel good',
  'open wide',
  'come along',
  'go get it',
  'lucky',
  'beauty',
  'warm',
  'childhood',
  'climb',
  'lighter',
  'sweet',
  'love',
];

const DARK_KEYWORDS = [
  'wish i was dead',
  'system crash',
  'memory overflow',
  'recursive loop',
  'stack trace',
  'null pointer',
  'segmentation fault',
  'buffer overflow',
  'thread deadlock',
  'heap corruption',
  'infinite recursion',
  'mutex poisoned',
  'pipe broken',
  'signal abort',
  'access violation',
  'page fault',
  'sigsegv',
  'core dumped',
  'frozen',
  'locked',
  'entropy',
  'break up',
  'stopping',
  'hard to ignore',
  'dont blame',
  'no service',
  'battle',
];

function isValidMood(value?: string | null): value is Mood {
  return value === 'light' || value === 'dark';
}

function normalizeMoodText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_\\[\\]\\-]+/g, ' ')
    .replace(/[^a-z0-9\\s]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function inferMoodFromText(value: string): Mood | null {
  const normalized = normalizeMoodText(value);
  if (!normalized) return null;

  const haystack = ` ${normalized} `;
  let score = 0;

  for (const keyword of LIGHT_KEYWORDS) {
    if (haystack.includes(` ${keyword} `)) score += 1;
  }
  for (const keyword of DARK_KEYWORDS) {
    if (haystack.includes(` ${keyword} `)) score -= 1;
  }

  if (score > 0) return 'light';
  if (score < 0) return 'dark';
  return null;
}

export function resolveReleaseMood(
  release: Pick<Release, 'day' | 'title' | 'storageTitle' | 'fileName' | 'description' | 'customInfo' | 'mood'> & {
    overrideMood?: string | null;
  }
): Mood {
  if (isValidMood(release.overrideMood)) return release.overrideMood;

  const databaseMood = DATABASE_DAY_MOODS[release.day];
  if (isValidMood(databaseMood)) return databaseMood;

  const legacyMood = LEGACY_DAY_MOODS[release.day];
  if (isValidMood(legacyMood)) return legacyMood;

  if (isValidMood(release.mood)) return release.mood;

  const moodText = [
    release.title,
    release.storageTitle,
    release.fileName,
    release.description,
    release.customInfo,
  ]
    .filter(Boolean)
    .join(' ');

  const inferred = inferMoodFromText(moodText);
  if (isValidMood(inferred)) return inferred;

  return release.day % 2 === 0 ? 'light' : 'dark';
}
"""
    MOOD_RESOLVER_PATH.write_text(content)


def patch_use_store() -> None:
    source = USE_STORE_PATH.read_text()

    if "import { resolveReleaseMood } from '../services/moodResolver';" not in source:
        source = source.replace(
            "import { getReleaseAudioUrl } from '../services/releaseStorage';",
            "import { getReleaseAudioUrl } from '../services/releaseStorage';\nimport { resolveReleaseMood } from '../services/moodResolver';",
        )

    source = source.replace(
        "let contentOverrides: Record<number, { title?: string; info?: string; videoUrl?: string }> = {};",
        "let contentOverrides: Record<number, { title?: string; info?: string; videoUrl?: string; mood?: 'light' | 'dark' }> = {};",
    )

    final_processing_pattern = re.compile(
        r"// --- 3\. FINAL PROCESSING: APPLY OVERRIDES ---\n\s+if \(dataToUse\) \{\n(?:.|\n)*?\n\s+\} else \{",
        re.MULTILINE,
    )

    replacement = """// --- 3. FINAL PROCESSING: APPLY OVERRIDES + MOOD RESOLUTION ---
      if (dataToUse) {
        dataToUse.releases = dataToUse.releases.map((release) => {
          const overrides = contentOverrides[release.day];

          const mergedRelease = overrides
            ? {
                ...release,
                title: overrides.title || release.title,
                customInfo: overrides.info || release.customInfo,
                videoUrl: overrides.videoUrl || release.videoUrl,
              }
            : release;

          const mood = resolveReleaseMood({
            day: mergedRelease.day,
            title: mergedRelease.title,
            storageTitle: mergedRelease.storageTitle,
            fileName: mergedRelease.fileName,
            description: mergedRelease.description,
            customInfo: mergedRelease.customInfo,
            mood: mergedRelease.mood,
            overrideMood: overrides?.mood,
          });

          return {
            ...mergedRelease,
            mood,
          };
        });

        const lightTracks = dataToUse.releases.filter((release) => release.mood === 'light').length;
        const darkTracks = dataToUse.releases.length - lightTracks;
        dataToUse.stats = {
          ...dataToUse.stats,
          totalReleases: dataToUse.releases.length,
          lightTracks,
          darkTracks,
        };

        set({ data: dataToUse, loading: false });
        get().calculateCurrentDay();
      } else {"""

    source, count = final_processing_pattern.subn(replacement, source, count=1)
    if count != 1:
        raise RuntimeError("Could not patch final processing block in useStore.ts")

    USE_STORE_PATH.write_text(source)


def main() -> None:
    database_day_moods = build_database_day_moods()
    legacy_day_moods = build_legacy_day_moods()

    write_day_map_ts(
        DATABASE_MAP_PATH,
        "DATABASE_DAY_MOODS",
        "// Auto-generated from database-complete-1771749929478.json using valence + mood-tag scoring.",
        database_day_moods,
    )
    write_day_map_ts(
        LEGACY_MAP_PATH,
        "LEGACY_DAY_MOODS",
        "// Legacy mood map from old_nfo/public/releases.json (first known mood per day).",
        legacy_day_moods,
    )
    write_mood_resolver()
    patch_use_store()

    print(f"Wrote database map: {DATABASE_MAP_PATH} ({len(database_day_moods)} days)")
    print(f"Wrote legacy map: {LEGACY_MAP_PATH} ({len(legacy_day_moods)} days)")
    print(f"Patched: {USE_STORE_PATH}")


if __name__ == "__main__":
    main()
