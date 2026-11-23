from babyroo_crawler.sources.seoul_kids_cafe import make_list_url, fetch_text_url, extract_cards, parse_list_page
url = make_list_url(1, "2001")
html = fetch_text_url(url)
cards = extract_cards(html)
print("cards matched:", len(cards))
if cards:
    print("--- first card (first 400 chars) ---")
    print(cards[0][:400])
    parsed = parse_list_page(html, "2026-11-17", "2001")
    print("parsed events:", len(parsed))
    for p in parsed[:3]:
        print(" -", p.get("title"), "| age:", p.get("age_text"), "| loc:", p.get("locality"))
