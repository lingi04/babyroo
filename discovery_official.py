import json

raw = json.load(open('data/discovery/google_alerts.json', encoding='utf-8'))
hits_by_kw = raw['keywords']

# 공식 출처로 간주할 도메인 (서울 시 공식 미디어/공원/관광/공식 시설)
OFFICIAL_DOMAINS = [
    'seoul.go.kr',          # 서울시 공식 사이트
    'parks.seoul.go.kr',    # 서울공원 공식
    'korean.visitseoul.net','visitseoul.net',  # 서울시 관광 공식
    'seoulchildrensmuseum.org','seoulchildrensmuseum',  # 서울상상나라 공식
    'go.seoul.co.kr',       # 서울신문 공식(시)
    'mediahub.seoul.go.kr', # 서울 미디어허브 (공식 보도)
    'koreathisweek.com',
]

# 제외: 개인 블로그/펌
EXCLUDE_DOMAINS = [
    'blog.naver.com',
    'blog.naver.com/',
    'naver.com',
]

def is_official(url):
    if not url:
        return False
    for d in OFFICIAL_DOMAINS:
        if d in url:
            return True
    for e in EXCLUDE_DOMAINS:
        if e in url:
            return False
    # 네이버를 제외한 다른 오픈 블로그도 일단 제외 (공식 아님)
    if 'blog.' in url or 'tistory.com' in url or 'egloos.com' in url:
        return False
    return False

all_hits = []
for kw, hits in hits_by_kw.items():
    for h in hits:
        all_hits.append({'keyword': kw, 'url': h.get('url',''), 'title': h.get('title',''), 'description': h.get('description',''), 'rank': h.get('rank')})

# URL 중복 제거 (첫째 것 유지)
seen = {}
for h in all_hits:
    seen.setdefault(h['url'], h)

print("전체 후보:", len(seen))
print("공식 출처:", sum(1 for h in seen.values() if is_official(h['url'])))
print("블로그/문서(공식 아님):", sum(1 for h in seen.values() if not is_official(h['url'])))

print("\n========== 공식 출처만 (공식 주소) ==========")
for i, h in enumerate(sorted([h for h in seen.values() if is_official(h['url'])], key=lambda x: (x['rank'], x['keyword'])), 1):
    print(f"{i}. [{h['keyword']}] {h['title'][:60]}")
    print(f"   → {h['url']}")

print("\n========== 공식 주소 없음 (블로그만) ==========")
for i, h in enumerate(sorted([h for h in seen.values() if not is_official(h['url'])], key=lambda x: (x['rank'], x['keyword'])), 1):
    print(f"{i}. [{h['keyword']}] {h['title'][:60]}")
    print(f"   → {h['url']}")
