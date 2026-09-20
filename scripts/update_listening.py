#!/usr/bin/env python3
"""Refresh the listening catalogue from publisher podcast RSS feeds."""

import argparse
import hashlib
import html
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/data/listening.json"
ITUNES = "http://www.itunes.com/dtds/podcast-1.0.dtd"
SOURCES = (
    {"id": "teppei", "name": "Nihongo con Teppei", "feed": "https://nihongoconteppei.com/feed/", "url": "https://nihongoconteppei.com/"},
    {"id": "picnic", "name": "Nihongo Picnic", "feed": "https://anchor.fm/s/2e08a010/podcast/rss", "url": "https://www.nihongopicnic.com/blog-categories/podcast"},
    {"id": "bitesize", "name": "Bite Size Japanese", "feed": "https://anchor.fm/s/463a19c0/podcast/rss", "url": "https://podcasts.apple.com/us/podcast/the-bite-size-japanese-podcast/id1588405417"},
    {"id": "nhk", "name": "NHK Easy Japanese", "feed": "https://www3.nhk.or.jp/nhkworld/lesson/en/rss/podcast.xml", "url": "https://www3.nhk.or.jp/nhkworld/lesson/en/"},
)

CATEGORIES = (
    ("Ẩm thực", r"食|料理|ご飯|ラーメン|カフェ|レストラン|飲み|お菓子|弁当|コーヒー|茶|パン|restaurant|food|eat"),
    ("Đi lại", r"旅行|電車|駅|空港|バス|散歩|道|引っ越し|ホテル|観光|directions|train|travel"),
    ("Công việc", r"仕事|会社|働|就職|アルバイト|職場|面接|会議|occupation|work"),
    ("Học tập", r"勉強|学校|大学|授業|日本語|言葉|言語|試験|漢字"),
    ("Văn hóa", r"文化|祭|アニメ|漫画|ドラマ|映画|音楽|伝統|正月|クリスマス"),
    ("Quan hệ", r"友達|家族|子ども|こども|恋愛|結婚|人間関係|夫|妻|母|父"),
    ("Sức khỏe", r"健康|病気|運動|スポーツ|ジム|睡眠|疲れ|ストレス"),
    ("Phỏng vấn", r"インタビュー|対談|ゲスト|👥"),
)


def clean(value):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", value or ""))).strip()


def duration_seconds(value):
    parts = (value or "").split(":")
    try:
        return sum(int(part) * 60 ** index for index, part in enumerate(reversed(parts)))
    except ValueError:
        return 0


def levels(source_id, title):
    if source_id in ("teppei", "nhk"):
        return ["N4"]
    if source_id == "picnic":
        if "🚲" in title:
            return ["N4"]
        if "🚃" in title:
            return ["N3"]
        if "🚀" in title:
            return ["N2"]
        return ["N3", "N2"]
    return ["N3", "N2"]


def parse_feed(source, raw):
    root = ET.fromstring(raw)
    entries = []
    for item in root.findall("./channel/item"):
        title = clean(item.findtext("title"))
        enclosure = item.find("enclosure")
        audio = enclosure.get("url", "") if enclosure is not None else ""
        if not title or not audio.startswith(("https://", "http://")):
            continue
        guid = item.findtext("guid") or item.findtext("link") or audio
        published = item.findtext("pubDate") or ""
        try:
            from email.utils import parsedate_to_datetime
            published = parsedate_to_datetime(published).astimezone(timezone.utc).isoformat()
        except (ValueError, TypeError):
            published = ""
        category = next((name for name, pattern in CATEGORIES if re.search(pattern, title, re.IGNORECASE)), "Chủ đề khác")
        kind = "Bài học hội thoại" if source["id"] == "nhk" else "Phỏng vấn" if "👥" in title else "Podcast"
        source_url = item.findtext("link") or source["url"]
        if not source_url.startswith(("https://", "http://")):
            source_url = source["url"]
        entries.append({
            "id": source["id"] + "-" + hashlib.sha1(guid.encode()).hexdigest()[:14],
            "sourceId": source["id"],
            "title": title,
            "levels": levels(source["id"], title),
            "category": category,
            "kind": kind,
            "publishedAt": published,
            "durationSeconds": duration_seconds(item.findtext(f"{{{ITUNES}}}duration")),
            "audioUrl": audio.replace("http://media.blubrry.com/", "https://media.blubrry.com/"),
            "sourceUrl": source_url,
        })
    return entries


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--feed-dir", type=Path, help="Use local listening-feed-0.xml etc. for verification")
    args = parser.parse_args()
    previous = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {"episodes": []}
    preserved = {episode["id"]: episode for episode in previous["episodes"]}
    success = 0
    for index, source in enumerate(SOURCES):
        try:
            if args.feed_dir:
                raw = (args.feed_dir / f"listening-feed-{index}.xml").read_bytes()
            else:
                request = urllib.request.Request(source["feed"], headers={"User-Agent": "NhatListeningCatalogue/1.0"})
                with urllib.request.urlopen(request, timeout=30) as response:
                    raw = response.read()
            entries = parse_feed(source, raw)
            if not entries:
                raise ValueError("feed has no playable episodes")
            preserved.update({entry["id"]: entry for entry in entries})
            success += 1
            print(f"{source['name']}: {len(entries)} episodes")
        except (OSError, ET.ParseError, ValueError) as error:
            print(f"{source['name']}: refresh failed: {error}")
    if not success:
        raise SystemExit("No feeds could be refreshed; keeping existing catalogue")
    episodes = sorted(preserved.values(), key=lambda entry: entry["publishedAt"], reverse=True)
    result = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": [{key: value for key, value in source.items() if key != "feed"} for source in SOURCES],
        "episodes": episodes,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Saved {len(episodes)} episodes")


if __name__ == "__main__":
    main()
