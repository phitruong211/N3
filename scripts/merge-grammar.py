"""Merge authored grammar lessons into public/data/grammar<Level>.json.

Source format (one or more files), blank lines ignored:
  T <n> <lesson title>            lesson heading
  @<front>  or  @+<front>         existing card (front unchanged keeps progress) / new card
  R <reading>                     reading (new cards; defaults to the front)
  L <n>                           lesson number
  M <meaning>                     first line of the back
  S / C / U / N / P / W <text>    Cấu trúc / Cách chia / Cách dùng / Sắc thái / Phân biệt / Lưu ý
  E <japanese> | <reading> | <meaning>
A line starting with two spaces continues the previous field on a new line.
An existing card without M keeps its back and examples; given C/N/P/W sections and E examples are appended (augment mode).
Cards are written in lesson order; a card left out of the sources keeps its content and sorts last.
Run: python3 scripts/merge-grammar.py N5 file1.txt [file2.txt ...]
"""
import json, sys, uuid, pathlib

DATA = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'data'
SECTIONS = [('S', 'Cấu trúc'), ('C', 'Cách chia'), ('U', 'Cách dùng'), ('N', 'Sắc thái'), ('P', 'Phân biệt'), ('W', 'Lưu ý')]


def parse(paths):
    titles, cards, card, last = {}, [], None, None
    for path in paths:
        for raw in pathlib.Path(path).read_text().splitlines():
            if not raw.strip() or raw.startswith('#'):
                continue
            if raw.startswith('  ') and card is not None and last:
                card[last][-1] += '\n' + raw.strip()
                continue
            key, _, value = raw.partition(' ')
            if raw.startswith('@'):
                new = raw.startswith('@+')
                card = {'front': raw[2:].strip() if new else raw[1:].strip(), 'new': new}
                cards.append(card)
                last = None
            elif key == 'T':
                number, _, title = value.partition(' ')
                titles[int(number)] = title.strip()
            elif card is None:
                raise SystemExit(f'Field before any card: {raw}')
            else:
                card.setdefault(key, []).append(value.strip())
                last = key
    return titles, cards


def build_back(card):
    parts = [card['M'][0]]
    for key, title in SECTIONS:
        if key in card:
            parts.append(f'【{title}】\n' + '\n'.join(card[key]))
    return '\n\n'.join(parts)


def main(level, paths):
    path = DATA / f'grammar{level}.json'
    rows = json.loads(path.read_text())
    by_front = {row['front']: row for row in rows}
    titles, cards = parse(paths)
    seen, ordered = set(), []
    for card in cards:
        front = card['front']
        assert front not in seen, f'Duplicate card {front}'
        seen.add(front)
        augment = not card['new'] and 'M' not in card
        for required in (('L',) if augment else ('L', 'M', 'S', 'U', 'E')):
            assert required in card, f'{front}: missing {required}'
        assert not (augment and ('S' in card or 'U' in card)), f'{front}: S/U need M (full rewrite)'
        lesson = int(card['L'][0])
        assert lesson in titles, f'{front}: lesson {lesson} has no title'
        if card['new']:
            assert front not in by_front, f'{front} already exists; drop the +'
            row = {'note_id': str(uuid.uuid4()), 'front': front, 'reading': card.get('R', [front])[0], 'han_viet': None, 'type': 'GRAMMAR'}
        else:
            assert front in by_front, f'Unknown existing card {front}'
            row = by_front[front]
        examples = []
        for line in card.get('E', []):
            parts = [p.strip() for p in line.split('|')]
            assert len(parts) == 3 and parts[0] and parts[2], f'{front}: bad example {line}'
            examples.append({'japanese': parts[0], 'reading': parts[1], 'meaning': parts[2]})
        if augment:  # keep the supplied examples first, then add the new ones
            examples = row.get('examples', []) + [e for e in examples if e['japanese'] not in {x['japanese'] for x in row.get('examples', [])}]
        if not augment:
            back = build_back(card)
        else:
            back = row['back']
            for key, title in SECTIONS:
                if key not in card or f'【{title}】' in back:
                    continue
                section = f'\n\n【{title}】\n' + '\n'.join(card[key])
                # The conjugation table reads best right before the usage notes.
                at = back.find('\n\n【Cách dùng】') if key == 'C' else -1
                back = back[:at] + section + back[at:] if at >= 0 else back + section
        row.update({'back': back, 'note': '', 'examples': examples,
                    'tags': [level, 'ngữ pháp', f'Bài {lesson}: {titles[lesson]}']})
        ordered.append((lesson, len(ordered), row))
    rest = [row for row in rows if row['front'] not in seen]
    out = [row for _, _, row in sorted(ordered, key=lambda item: item[:2])] + rest
    # Keep key order stable for readable diffs.
    keys = ['note_id', 'front', 'back', 'reading', 'han_viet', 'note', 'type', 'tags', 'examples']
    out = [{k: row[k] for k in keys if k in row} for row in out]
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
    print(f'{level}: {len(ordered)} authored ({sum(c["new"] for c in cards)} new), {len(rest)} untouched, {len(out)} total')
    if rest:
        print('  untouched:', ', '.join(row['front'] for row in rest))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
