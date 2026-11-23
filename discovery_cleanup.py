import json, re

raw = json.load(open('data/discovery/google_alerts.json', encoding='utf-8'))
hits_by_kw = raw['keywords']
all_hits = []
for kw, hits in hits_by_kw.items():
    for h in hits:
        all_hits.append({'keyword': kw, 'url': h.get('url',''), 'title': h.get('title',''), 'description': h.get('description',''), 'rank': h.get('rank')})

# URL 중복 제거 (첫째 것 유지)
seen = {}
for h in all_hits:
    seen.setdefault(h['url'], h)
print("중복 제거 전:", len(all_hits), "후:", len(seen))

# 장소 후보 판별 키워드
VENUE_KWS = ['키즈카페','실내놀이터','키즈런','서울상상나라','실내 놀이터','상상나라','서울갤러리','디키디키','렛츠런파크','서울숲','용산가족공원','물놀이터','공원','가족공원']
NOISE_KWS = ['총정리','모음','맨 위 링크','나들이.zip','명소 6곳','가볼 만한 곳','가볼만한곳','추천','후기','코스','일정이','함께','나들이.zip']

def classify(title, desc):
    t = (title + ' ' + desc).lower()
    if any(k in t for k in ['총정리','모음','맨 위 링크','나들이.zip','명소 6곳']):
        return 'NOISE'
    if any(k in t for k in ['가볼 만한 곳','가볼만한곳','추천','후기','코스','일정이','함께']):
        for kw in ['키즈런','상상나라','서울갤러리','디키디키','렛츠런파크','서울숲','용산가족공원','물놀이터','실내놀이터','가족공원','키즈카페']:
            if kw in t:
                return 'VENUE'
        return 'NOISE'
    for kw in VENUE_KWS:
        if kw in t:
            return 'VENUE'
    return 'NOISE'

def locality(title, desc):
    t = (title + ' ' + desc)
    m = {'화곡3동':'강서구','천왕':'구로구','목동':'양천구','동대문':'동대문구','DDP':'동대문구','서울숲':'성동구','용산':'용산구','과천':'과천시','서울대공원':'과천시','서대문':'서대문구','여의도':'영등포구/마포구','한강':'영등포구/마포구'}
    for k, v in m.items():
        if k in t:
            return v
    return ''

def venue_name(title, desc):
    t = (title + ' ' + desc)
    for kw in ['천왕근린공원점','키즈런 스포츠파크','서울상상나라','서울갤러리','디키디키','렛츠런파크 포니랜드','서울숲','용산가족공원','물놀이터','실내놀이터','서울형 키즈카페']:
        if kw in t:
            return kw
    for kw in VENUE_KWS:
        if kw in t:
            return kw
    return '(장소명 추정 불가)'

cleaned = []
for h in seen.values():
    cls = classify(h['title'], h['description'])
    if cls == 'NOISE':
        continue
    cleaned.append({
        'keyword': h['keyword'],
        'rank': h['rank'],
        'venue_name': venue_name(h['title'], h['description']),
        'locality': locality(h['title'], h['description']),
        'url': h['url'],
        'title': h['title'],
        'quality': '신규 후보' if h['rank'] == '1' else '검토 필요',
    })

cleaned.sort(key=lambda x: (x['rank'], x['keyword']))
print("\n== 정제 완료: 장소 후보 ==")
for i, c in enumerate(cleaned, 1):
    print(f"{i}. [{c['keyword']}] {c['venue_name']} ({c['locality']}) - {c['url']}")
    print(f"   제목: {c['title'][:70]}  | 품질: {c['quality']}")
print("\n총", len(cleaned), "건 (NOISE 제외)")
