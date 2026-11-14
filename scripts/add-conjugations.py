"""Write verb and adjective conjugation tables into the N5 and N4 vocabulary cards.

Re-runnable: each run replaces the generated 【Chia ...】 block in `note` and the group tag.
N4 verbs stored in ます form are rewritten once to the dictionary form, like N5 and N3.
Run: python3 scripts/add-conjugations.py
"""
import json, re, pathlib

DATA = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'data'
ROWS = {'a': 'あかがさざただなはばぱまやらわ', 'i': 'いきぎしじちぢにひびぴみ・りゐ', 'u': 'うくぐすずつづぬふぶぷむゆるう', 'e': 'えけげせぜてでねへべぺめ・れゑ', 'o': 'おこごそぞとどのほぼぽもよろを'}
GODAN = 'うくぐすつぬぶむる'
SHIFT = {u: {row: ROWS[row][ROWS['u'].index(u)] for row in 'aieo'} for u in GODAN}
SHIFT['う']['a'] = 'わ'
TE = {'う': 'って', 'つ': 'って', 'る': 'って', 'む': 'んで', 'ぶ': 'んで', 'ぬ': 'んで', 'く': 'いて', 'ぐ': 'いで', 'す': 'して'}

# ます forms whose stem would be misread by the vowel rule.
GODAN_SU = {'探します', '壊します', '汚します', '倒します', '外します', '落とします', '消します', '戻します', '冷やします', '沸かします',
            '下ろします', '過ごします', '申します', '渡します', 'さします', 'いたします', '貸します', '返します', '出します', '話します', '押します'}
ICHIDAN_I = {'診ます', 'できます', '落ちます', '起きます', '過ぎます', '信じます', '借ります', '見ます', '着ます', '降ります', '浴びます', '生きます', '足ります'}
HONORIFIC = {'おっしゃいます': 'おっしゃる', 'なさいます': 'なさる', 'くださいます': 'くださる', 'いらっしゃいます': 'いらっしゃる', 'ございます': 'ござる'}
NOT_VERB = {'存じております', 'お越しください', 'ご遠慮ください'}  # set phrases: keep as learned
SPECIAL_IKU = {'行く', '行って来る'}
# Polite verbs: only the forms a learner meets.
POLITE = {'おっしゃる', 'なさる', 'くださる', 'いらっしゃる', '召し上がる', '参る', 'おる', '申す', 'いたす', '伺う', '拝見する', 'お目にかかる', 'ご覧になる'}

I_ADJ_NOT = {'はい', 'きれい', '嫌い', 'ごめんなさい', 'おやすみなさい'}
NA_ADJ = {'N5': {'大丈夫', '大変', '暇', '元気', '静か', '賑やか', '有名', '便利', '不便', '好き', '嫌い', '上手', '下手', 'きれい', '簡単', '親切', '大切', '丈夫', 'いろいろ'},
          'N4': {'複雑', '邪魔', '危険', '必要', '丈夫', '変', '幸せ', '楽', '安全', '丁寧', '嫌', 'まじめ', '熱心', '十分', 'だめ', '自由'}}
I_ADJ_N4 = {'すばらしい', 'えらい', 'ちょうどいい', 'おかしい', 'うるさい', '苦い', '正しい', '硬い', '軟らかい', '気持ちがいい', '気持ちが悪い',
            '悲しい', '恥ずかしい', 'かわいい', '珍しい', 'うまい', 'まずい', 'つまらない', '優しい', '細かい', '濃い', '薄い', '厳しい', 'ひどい'}
FIXES = {('守ります', 'ままリます'): 'まもります', ('正しい', '正しい'): 'ただしい', ('入学します', 'にゅう学します'): 'にゅうがくします'}


def to_dictionary(front, reading):
    """ます form -> (dictionary form, reading, group); None when not a verb."""
    if front in NOT_VERB or not front.endswith('ます'):
        return None
    if front in HONORIFIC:
        return HONORIFIC[front], HONORIFIC[front], 1
    if front.endswith('来ます'):
        return front[:-2] + 'る', reading[:-3] + 'くる', 3
    if front.endswith('します') and front not in GODAN_SU:
        return front[:-3] + 'する', reading[:-3] + 'する', 3
    stem, rstem = front[:-2], reading[:-2]
    last = rstem[-1]
    if front in ICHIDAN_I or last in ROWS['e']:
        return stem + 'る', rstem + 'る', 2
    u = ROWS['u'][ROWS['i'].index(last)]
    tail = stem[-1] == last  # the stem ends in kana, so it changes with the reading
    return (stem[:-1] + u if tail else stem + u), rstem[:-1] + u, 1


def group_of(front, reading):
    if front.endswith('する'):
        return 3
    if front.endswith('来る') or front == 'くる':
        return 3
    if front in POLITE:
        return 1
    # ichidan: る after an i/e sound, except the godan verbs that look the same
    godan_ru = {'帰る', '入る', '切る', '知る', '走る', '要る', '減る', '滑る', '喋る', '限る', '参る', 'おる', '照る', '蹴る', '握る', '湿る'}
    if front.endswith('る') and front not in godan_ru and len(reading) > 1 and (reading[-2] in ROWS['i'] or reading[-2] in ROWS['e']):
        return 2
    return 1 if front[-1] in GODAN else None


def verb_forms(front, group):
    if group == 3:
        if front.endswith('来る') or front == 'くる':
            base = front[:-2] if front.endswith('来る') else ''
            k = '来' if front.endswith('来る') else ''
            ki, ko, ku = (k + '（き）', k + '（こ）', k + '（く）') if k else ('き', 'こ', 'く')
            return {'ます': f'{base}{ki}ます', 'て': f'{base}{ki}て', 'た': f'{base}{ki}た', 'ない': f'{base}{ko}ない',
                    'Khả năng': f'{base}{ko}られる', 'Ý chí': f'{base}{ko}よう', 'Mệnh lệnh': f'{base}{ko}い', 'Cấm': f'{base}{ku}るな',
                    'Điều kiện': f'{base}{ku}れば', 'Bị động': f'{base}{ko}られる', 'Sai khiến': f'{base}{ko}させる'}
        b = front[:-2]
        return {'ます': b + 'します', 'て': b + 'して', 'た': b + 'した', 'ない': b + 'しない', 'Khả năng': b + 'できる', 'Ý chí': b + 'しよう',
                'Mệnh lệnh': b + 'しろ', 'Cấm': b + 'するな', 'Điều kiện': b + 'すれば', 'Bị động': b + 'される', 'Sai khiến': b + 'させる'}
    if group == 2:
        b = front[:-1]
        return {'ます': b + 'ます', 'て': b + 'て', 'た': b + 'た', 'ない': b + 'ない', 'Khả năng': b + 'られる', 'Ý chí': b + 'よう',
                'Mệnh lệnh': b + 'ろ', 'Cấm': front + 'な', 'Điều kiện': b + 'れば', 'Bị động': b + 'られる', 'Sai khiến': b + 'させる'}
    b, u = front[:-1], front[-1]
    s = SHIFT[u]
    te = 'って' if front in SPECIAL_IKU or front.endswith('行く') else TE[u]
    forms = {'ます': b + s['i'] + 'ます', 'て': b + te, 'た': b + te[:-1] + ('だ' if te.endswith('で') else 'た'),
             'ない': ('ない' if front == 'ある' else b + s['a'] + 'ない'), 'Khả năng': b + s['e'] + 'る', 'Ý chí': b + s['o'] + 'う',
             'Mệnh lệnh': b + s['e'], 'Cấm': front + 'な', 'Điều kiện': b + s['e'] + 'ば', 'Bị động': b + s['a'] + 'れる', 'Sai khiến': b + s['a'] + 'せる'}
    if front in HONORIFIC.values():  # なさる -> なさいます, なさい
        forms['ます'] = b + 'います'
        forms['Mệnh lệnh'] = b + 'い'
    return forms


def i_adj_forms(front):
    b = front[:-2] + 'よ' if front.endswith('いい') else front[:-1]
    return {'Phủ định': b + 'くない', 'Quá khứ': b + 'かった', 'QK phủ định': b + 'くなかった', 'Nối (て)': b + 'くて',
            'Trạng từ': b + 'く', 'Điều kiện': b + 'ければ'}


def na_adj_forms(front):
    return {'Phủ định': front + 'じゃない', 'Quá khứ': front + 'だった', 'QK phủ định': front + 'じゃなかった', 'Nối (て)': front + 'で',
            'Trạng từ': front + 'に', 'Bổ nghĩa': front + 'な + N', 'Điều kiện': front + 'なら'}


BASIC = {'ます', 'て', 'た', 'ない', 'Phủ định', 'Quá khứ', 'QK phủ định', 'Nối (て)', 'Trạng từ', 'Bổ nghĩa'}
GROUP_TAG = {1: 'động từ nhóm I', 2: 'động từ nhóm II', 3: 'động từ nhóm III'}
GROUP_NAME = {1: 'Nhóm I (五段)', 2: 'Nhóm II (一段)', 3: 'Nhóm III (bất quy tắc)'}
BLOCK = re.compile(r'\n?【Chia (động|tính) từ[^\n]*】(\n(?!【)[^\n]*)*')
CONJ_TAGS = set(GROUP_TAG.values()) | {'tính từ い', 'tính từ な'}


def block(title, forms, level):
    keep = [(k, v) for k, v in forms.items() if level == 'N4' or k in BASIC]
    lines = [' · '.join(f'{k}: {v}' for k, v in keep[i:i + 4]) for i in range(0, len(keep), 4)]
    return f'【{title}】\n' + '\n'.join(lines)


def apply(level):
    path = DATA / f'vocab{level}.json'
    rows = json.loads(path.read_text())
    counts = {}
    for row in rows:
        fix = FIXES.get((row['front'], row['reading']))
        if fix:
            row['reading'] = fix
        known = next((g for g, t in GROUP_TAG.items() if t in row.get('tags', [])), None)
        if level == 'N4':
            converted = to_dictionary(row['front'], row['reading'])
            if converted:
                row['front'], row['reading'], known = converted
            if row['front'].endswith('な') and row['front'][:-1] in NA_ADJ['N4']:
                row['front'] = row['front'][:-1]
                row['reading'] = row['reading'].removesuffix('な')
        front = row['front']
        note = BLOCK.sub('', row.get('note') or '').strip()
        tags = [t for t in row.get('tags', []) if t not in CONJ_TAGS]
        text = None
        if front in NA_ADJ[level]:
            text, tag = block('Chia tính từ な', na_adj_forms(front), level), 'tính từ な'
        elif front.endswith('い') and front not in I_ADJ_NOT and (level == 'N5' or front in I_ADJ_N4) and group_of(front, row['reading']) is None:
            text, tag = block('Chia tính từ い', i_adj_forms(front), level), 'tính từ い'
        elif known or level == 'N5' and front not in NOT_VERB and re.search(f'[{GODAN}]$', front) and (any('Động từ thông dụng' in t for t in tags) or front.endswith('する') or front in {'疲れる', '休む', '分かる', '教える', '習う', '覚える', '忘れる', '読む', '書く', '聞く', '話す', '言う', 'ある', 'いる'}):
            group = known or group_of(front, row['reading'])
            if group:
                forms = verb_forms(front, group)
                if front in POLITE:
                    forms = {k: forms[k] for k in ('ます', 'て', 'た', 'ない')}
                text, tag = block(f'Chia động từ · {GROUP_NAME[group]}', forms, level), GROUP_TAG[group]
        if text:
            note = f'{note}\n{text}'.strip()
            tags.append(tag)
            counts[tag] = counts.get(tag, 0) + 1
        row['note'], row['tags'] = note, tags
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
    print(level, counts)


if __name__ == '__main__':
    assert verb_forms('書く', 1)['て'] == '書いて' and verb_forms('行く', 1)['た'] == '行った' and verb_forms('ある', 1)['ない'] == 'ない'
    assert verb_forms('買う', 1)['ない'] == '買わない' and verb_forms('食べる', 2)['Khả năng'] == '食べられる'
    assert to_dictionary('探します', 'さがします') == ('探す', 'さがす', 1) and to_dictionary('連絡します', 'れんらくします')[2] == 3
    assert to_dictionary('診ます', 'みます') == ('診る', 'みる', 2) and to_dictionary('飼います', 'かいます') == ('飼う', 'かう', 1)
    assert group_of('帰る', 'かえる') == 1 and group_of('起きる', 'おきる') == 2 and i_adj_forms('いい')['Phủ định'] == 'よくない'
    apply('N5')
    apply('N4')
