# Babyroo crawler

Babyroo의 데이터 파이프라인은 처음부터 작게 시작합니다.

```text
data/raw/*.json -> data/normalized/events.json -> public/events.json
```

## 실행

샘플 데이터로 전체 흐름 확인:

```bash
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-sample
```

서울문화포털 실제 데이터 수집부터 공개까지:

```bash
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-seoul --pages 5
```

서울시육아종합지원센터 부모·가족 대상 행사 수집:

```bash
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-childcare --months 3
```

디키디키 입장 및 워크샵 프로그램 수집:

```bash
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-dikidiki
```

실제 수집원을 한 번에 실행:

```bash
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-all --pages 5 --months 3
```

단계별 실행:

```bash
PYTHONPATH=crawler python3 -m babyroo_crawler.cli collect-sample
PYTHONPATH=crawler python3 -m babyroo_crawler.cli collect-seoul --pages 5
PYTHONPATH=crawler python3 -m babyroo_crawler.cli collect-childcare --months 3
PYTHONPATH=crawler python3 -m babyroo_crawler.cli collect-dikidiki
PYTHONPATH=crawler python3 -m babyroo_crawler.cli normalize
PYTHONPATH=crawler python3 -m babyroo_crawler.cli publish
```

## 동작 구조

1. `collect-seoul`
   - 서울문화포털의 행사 목록 JSON을 조회합니다.
   - 최신 교육/체험·공연 목록과 `영유아`, `유아`, `베이비`, `개월`, `서울상상나라` 검색 결과를 함께 조회합니다.
   - 제목과 요약에 영유아 관련 표현이 있는 후보만 상세 페이지를 조회합니다.
   - 상세 대상 연령이 0~3세와 겹치지 않거나 유치원·어린이집 기관 전용인 행사는 제외합니다.
   - 대상, 요금, 기간, 장소, 설명을 파싱해 `data/raw/seoul_culture.json`에 저장합니다.

2. `normalize`
   - `data/raw/*.json`을 모두 읽습니다.
   - 출처별 표현을 Babyroo 공통 스키마로 바꿉니다.
   - 결과를 `data/normalized/events.json`에 저장합니다.

3. `publish`
   - 종료 행사와 필수값이 없는 행사를 제외합니다.
   - 웹이 읽을 `public/events.json`을 생성합니다.
   - 제외 이유는 `data/normalized/publish_report.json`에 기록합니다.

수집기와 정규화를 분리했기 때문에, 다음 사이트를 추가할 때는 `crawler/sources/`에 collector만 추가하고 기존 normalize/publish 흐름을 재사용할 수 있습니다.

서울시육아종합지원센터는 `나들이정보`가 기사형 콘텐츠라 행사 날짜를 안정적으로 얻기 어렵습니다. 그래서 현재 collector는 `행사/교육` 달력에서 부모·가족 대상 일정만 수집하고, 보육교직원·원장·교사 대상 교육은 제외합니다.

디키디키는 상설 입장과 워크샵 프로그램이 함께 있는 수집원입니다. `crawler/sources/dikidiki.py`는 상설 입장을 `venue_admission`, 워크샵을 `program`으로 raw payload에 구분해 저장하고, 기존 normalize/publish 흐름으로 Babyroo 공통 이벤트 스키마에 맞춥니다.
