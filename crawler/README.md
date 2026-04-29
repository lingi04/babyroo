# Babyroo crawler

Babyroo의 데이터 파이프라인은 처음부터 작게 시작합니다.

```text
data/raw/*.json -> data/normalized/events.json -> public/events.json
```

## 실행

```bash
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-sample
```

단계별 실행:

```bash
PYTHONPATH=crawler python3 -m babyroo_crawler.cli collect-sample
PYTHONPATH=crawler python3 -m babyroo_crawler.cli normalize
PYTHONPATH=crawler python3 -m babyroo_crawler.cli publish
```

## 다음에 붙일 것

- 사이트별 collector를 `crawler/sources/`에 추가
- 원문 HTML 또는 API 응답은 `data/raw/`에 저장
- 정규화 규칙은 `crawler/babyroo_crawler/normalize.py`에 추가
- 웹에서 읽을 최종 파일은 `public/events.json`만 바라보게 유지

