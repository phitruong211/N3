"""Add examples and new words to public/data/vocab<Level>.json.

  examples <Level> <file>...   lines "từ|câu tiếng Nhật|cách đọc|nghĩa" (cách đọc may be empty)
                               "từ@cách đọc|…" picks one of two words written the same way
  add <Level> <file>...        "T <lesson title>" headings, then
                               "từ|cách đọc|Hán Việt|nghĩa|câu tiếng Nhật|cách đọc câu|nghĩa câu"
  lessons <Level> <file>       lines "từ|n" put existing words into lesson n (titles from "T n title" lines)

New words are appended, so index-based ids (N4, N3, N2) never move. A word already taught at this or a
lower level (same writing and reading) is skipped. N3 uses its richer schema; the others use study cards.
"""
import json, re, sys, uuid, pathlib

DATA = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'data'
ORDER = ['N5', 'N4', 'N3', 'N2']


def load(level):
    return json.loads((DATA / f'vocab{level}.json').read_text())


def save(level, rows):
    (DATA / f'vocab{level}.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')


def front(row):
    return row.get('front', row.get('tu'))


def reading(row):
    return row.get('reading', row.get('phien_am'))


def lines(paths):
    for path in paths:
        for line in pathlib.Path(path).read_text().splitlines():
            if line.strip() and not line.startswith('#'):
                yield line.rstrip()


def examples(level, paths):
    rows = load(level)
    done, unknown = 0, []
    for line in lines(paths):
        key, jp, rd, vi = (p.strip() for p in line.split('|'))
        word, _, want = key.partition('@')
        matches = [r for r in rows if front(r) == word and (not want or reading(r) == want)]
        if not matches:
            unknown.append(key)
            continue
        target = next((r for r in matches if not r.get('examples')), matches[0])
        ex = target.setdefault('examples', [])
        if jp not in {e['japanese'] for e in ex}:
            ex.append({'japanese': jp, 'reading': rd, 'meaning': vi})
            done += 1
    save(level, rows)
    print(f'vocab{level}: {done} examples added; unknown: {", ".join(unknown) or "none"}; '
          f'words still without examples: {sum(1 for r in rows if not r.get("examples"))}')


def taught(level):
    seen = set()
    for lower in ORDER[:ORDER.index(level) + 1]:
        seen |= {(front(r), reading(r)) for r in load(lower)}
    return seen


def add(level, paths):
    rows = load(level)
    seen = taught(level)
    title, number = None, max((int(m[1]) for r in rows for t in r.get('tags', []) if (m := re.match(r'Bài (\d+)', t))), default=0)
    added, skipped, max_number = 0, [], number
    for line in lines(paths):
        if line.startswith('T '):
            head = line[2:].strip()
            first, _, rest = head.partition(' ')
            # "T 12 title" files words under an existing lesson; "T title" opens the next one.
            title, number = (rest.strip(), int(first)) if first.isdigit() else (head, max_number + 1)
            max_number = max(max_number, number)
            continue
        word, rd, hv, meaning, jp, jprd, vi = (p.strip() for p in line.split('|'))
        if (word, rd) in seen:
            skipped.append(word)
            continue
        seen.add((word, rd))
        lesson = f'Bài {number}: {title}'
        example = [{'japanese': jp, 'reading': jprd, 'meaning': vi}]
        if level == 'N3':
            rows.append({'note_id': str(uuid.uuid4()), 'id': max(r['id'] for r in rows) + 1, 'stt_goc': None, 'bai': number,
                         'tu': word, 'phien_am': rd, 'han_viet': hv or None, 'nghia': meaning, 'loai_tu': [], 'dong_tu': None,
                         'ghi_chu_dac_biet': None, 'tu_lien_quan': [], 'tags': ['N3', lesson], 'examples': example})
        else:
            rows.append({'note_id': str(uuid.uuid4()), 'front': word, 'back': meaning, 'reading': rd, 'han_viet': hv or None,
                         'note': '', 'type': 'VOCABULARY', 'tags': [level, 'từ vựng', lesson], 'examples': example})
        added += 1
    if level == 'N5':  # N5 ids follow the word, not the position, so the file can stay in lesson order
        lesson_of = lambda r: next((int(m[1]) for t in r['tags'] if (m := re.match(r'Bài (\d+)', t))), 99)
        rows.sort(key=lesson_of)
    save(level, rows)
    print(f'vocab{level}: {added} words added; skipped (already taught) {len(skipped)}: {"、".join(skipped) or "none"}')


def lessons(level, path):
    rows = load(level)
    titles, place = {}, {}
    for line in lines([path]):
        if line.startswith('T '):
            n, _, t = line[2:].partition(' ')
            titles[int(n)] = t.strip()
        else:
            key, n = line.rsplit('|', 1)
            place[key.strip()] = int(n)
    missing = []
    for r in rows:
        n = place.get(f'{front(r)}@{reading(r)}', place.get(front(r)))
        if n is None:
            missing.append(front(r))
            continue
        r['tags'] = [t for t in r.get('tags', []) if not re.match(r'(?i)bài\s*\d+', t)] + [f'Bài {n}: {titles[n]}']
        if level == 'N3':
            r['bai'] = n
    save(level, rows)
    print(f'vocab{level}: lessons set; without lesson: {"、".join(missing) or "none"}')


if __name__ == '__main__':
    {'examples': lambda: examples(sys.argv[2], sys.argv[3:]), 'add': lambda: add(sys.argv[2], sys.argv[3:]),
     'lessons': lambda: lessons(sys.argv[2], sys.argv[3])}[sys.argv[1]]()
