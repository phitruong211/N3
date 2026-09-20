# Listening library

The library lists podcast episodes for N4, N3 and N2 listening practice. Episodes remain on the publishers' servers; the app stores only feed metadata and links. It does not copy audio or transcripts.

## Sources and difficulty

- Nihongo con Teppei beginner feed: suggested N4.
- Nihongo Picnic: uses the publisher's 🚲 (easier/N4), 🚃 (about N3), and 🚀 (advanced, shown as suggested N2) labels. Unmarked episodes appear in N3 and N2.
- Bite Size Japanese: the publisher describes the show as N3–N2, so episodes appear at both levels.
- NHK Easy Japanese conversation lessons: suggested N4. This is a fixed course archive, while the podcast feeds above supply new episodes.

These are study suggestions, not official JLPT ratings. Topic tags are inferred from titles; unmatched titles use “Chủ đề khác”.

## Refresh

Run `python3 scripts/update_listening.py` to refresh `public/data/listening.json`. The script preserves existing episodes when a feed is temporarily unavailable or omits older entries. Add a publisher feed to `SOURCES` in the script to grow the library.

`.github/workflows/update-listening.yml` runs daily on the repository's default branch and commits the refreshed catalogue. The app first loads its bundled catalogue, then checks the latest file on GitHub so catalogue updates can appear without rebuilding the site. GitHub Actions and repository write permission must be enabled for scheduled updates. If the GitHub file cannot be reached, the bundled catalogue remains available.

The “Tải thêm” button reveals more episodes from the catalogue; it does not download the audio file. Playback is streamed from the source feed. When a source blocks playback, the original episode link remains available.

## Practice data

Saved, listened, difficult, hidden, and notes are stored in the browser's local storage under `nhat-listening-v1`. They do not sync across devices. Transcript based answer checking is intentionally absent until transcripts and usage permission are available for a source.

## JLPT-style practice

The separate “Luyện thi JLPT · Trắc nghiệm” tab contains 12 original N4/N3/N2 practice passages with 24 multiple-choice questions. These are independently authored exercises, not official JLPT exam recordings or past questions. Audio files in `public/audio/jlpt/` use the macOS Kyoko Japanese synthetic voice; regenerate them on macOS with `node scripts/generate_jlpt_audio.mjs`. Answers and Vietnamese sentence-by-sentence translations appear after the learner submits all questions. Best scores are stored locally under `nhat-jlpt-listening-scores-v1`. The podcast catalogue remains separate because its publishers have not provided verified transcripts for these exercises.
