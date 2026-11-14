"""Fill and extend the N3/N2 Kanji files (public/data/kanjiN3.json, kanjiN2.json).

  fill N3 <file>   lines "字|nghĩa|On、On|Kun、Kun" fill meaning and readings of existing entries
  fill N2 <file>   lines "字|nghĩa" fill the meaning of existing entries
  add N3 <file>    "T <lesson title>" headings, then "字|Hán Việt|nghĩa|On|Kun|語(よみ)=nghĩa; …" new entries
  levels           tag entries of the N2 source book that belong to N1 (or N3), from scripts/kanji-levels.txt
  lessons          number lessons: existing entries in groups of 20, new entries by their headings

New entries are appended, so the index-based ids of existing entries (and saved progress) never move.
A Kanji already present at any level is skipped. "—" means no reading.
"""
import json, re, sys, uuid, pathlib

DATA = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'data'
LEVELS = pathlib.Path(__file__).resolve().parent / 'kanji-levels.txt'


def load(name):
    return json.loads((DATA / f'{name}.json').read_text())


def save(name, rows):
    (DATA / f'{name}.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')


def readings(text):
    return [] if text.strip() in ('', '—') else [r.strip() for r in re.split('[、,]', text) if r.strip()]


def known_kanji():
    found = {row['front'] for name in ('kanjiN5', 'kanjiN4') for row in load(name)}
    return found | {row['kanji'] for name in ('kanjiN3', 'kanjiN2') for row in load(name)}


def lines(path):
    return [line.rstrip('\n') for line in pathlib.Path(path).read_text().splitlines() if line.strip() and not line.startswith('#')]


def fill(level, path):
    name = f'kanji{level}'
    rows = load(name)
    by = {}
    for row in rows:
        by.setdefault(row['kanji'], []).append(row)
    done = 0
    for line in lines(path):
        parts = line.split('|')
        for row in by.get(parts[0], []):
            row['meaning'] = parts[1].strip()
            if level == 'N3':
                row['onyomi'], row['kunyomi'] = readings(parts[2]), readings(parts[3])
            done += 1
    # Rows from the PDF extraction with no or English-only meanings are noise on a card.
    for row in rows:
        row['words'] = [w for w in row['words'] if w.get('meaning') and (re.search('[à-ỹđ]', w['meaning'], re.I) or not re.search('[A-Za-z]{3}', w['meaning']))]
    save(name, rows)
    missing = [row['kanji'] for row in rows if not row.get('meaning')]
    print(f'{name}: filled {done}; still without meaning: {"".join(missing) or "none"}')


def add(level, path):
    name = f'kanji{level}'
    rows = load(name)
    have = known_kanji()
    title, added, skipped = None, 0, []
    for line in lines(path):
        if line.startswith('T '):
            title = line[2:].strip()
            continue
        kanji, hv, meaning, on, kun, words = (p.strip() for p in line.split('|'))
        if hv == '—':
            continue
        if kanji in have:
            skipped.append(kanji)
            continue
        entry = {'note_id': str(uuid.uuid4()), 'kanji': kanji, 'han_viet': hv, 'meaning': meaning,
                 'onyomi': readings(on), 'kunyomi': readings(kun), 'words': [], 'note': '', 'examples': [], 'group': title}
        for item in words.split(';'):
            match = re.match(r'\s*(.+?)\((.+?)\)=(.+)', item)
            assert match, f'{kanji}: bad word {item}'
            entry['words'].append({'word': match[1], 'reading': match[2], 'meaning': match[3].strip()})
        assert entry['words'], kanji
        rows.append(entry)
        have.add(kanji)
        added += 1
    save(name, rows)
    print(f'{name}: added {added}; skipped (already present) {"".join(skipped) or "none"}')


def levels():
    marks = dict(line.split(':') for line in lines(LEVELS))
    rows = load('kanjiN2')
    for row in rows:
        for level, chars in marks.items():
            if row['kanji'] in chars:
                if level.strip() == 'hidden':
                    row['hidden'] = True  # extraction noise; kept so later ids do not shift
                else:
                    row['level'] = level.strip()
    save('kanjiN2', rows)
    print('kanjiN2 levels:', {lvl: sum(r.get('level') == lvl for r in rows) for lvl in ('N1', 'N3')})


def lessons():
    """Group each deck into lessons: authored groups keep their title, older entries go 20 to a lesson."""
    for name in ('kanjiN3', 'kanjiN2'):
        rows = load(name)
        for level in ('N3', 'N2', 'N1'):
            group = [row for row in rows if row.get('level', name[-2:]) == level]
            number, count, part, current = 0, 0, 0, object()
            for row in group:
                key = row.get('group') or None
                if key != current or count == 20:
                    part = part + 1 if key == current else 1
                    number, count, current = number + 1, 0, key
                count += 1
                size = sum(1 for other in group if (other.get('group') or None) == key)
                title = f'{key} ({part})' if key and size > 20 else key
                row['lesson'] = f'Bài {number}: {title}' if key else f'Bài {number}'
            # A lesson of a handful of leftovers joins the lesson before it.
            sizes = {}
            for row in group:
                sizes[row['lesson']] = sizes.get(row['lesson'], 0) + 1
            previous = None
            for row in group:
                if sizes[row['lesson']] < 5 and previous and previous != row['lesson']:
                    row['lesson'] = previous
                previous = row['lesson']
            order = list(dict.fromkeys(row['lesson'] for row in group))
            bases = [re.sub(r' \(\d+\)$', '', tag.partition(': ')[2]) for tag in order]
            for row in group:  # renumber 1..n after merging, keep titles
                title = row['lesson'].partition(': ')[2]
                if bases.count(re.sub(r' \(\d+\)$', '', title)) == 1:
                    title = re.sub(r' \(\d+\)$', '', title)
                n = order.index(row['lesson']) + 1
                row['lesson'] = f'Bài {n}: {title}' if title else f'Bài {n}'
        save(name, rows)
    print('lessons numbered')


if __name__ == '__main__':
    command = sys.argv[1]
    if command == 'fill':
        fill(sys.argv[2], sys.argv[3])
    elif command == 'add':
        add(sys.argv[2], sys.argv[3])
    elif command == 'levels':
        levels()
    elif command == 'lessons':
        lessons()
