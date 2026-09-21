#!/usr/bin/env python3
"""tests/*.json + pages/*.md -> dist/  (정적 사이트 생성)

사용법:
  python build.py            # 오늘 날짜 기준, publish <= 오늘 인 검사만 발행
  python build.py --all      # 날짜 무시하고 전부 발행 (미리보기용)
"""
import json, sys, shutil, datetime, pathlib
from xml.sax.saxutils import escape
NL = chr(10)
from jinja2 import Environment, FileSystemLoader

ROOT = pathlib.Path(__file__).parent
DIST = ROOT / "dist"
TODAY = datetime.date.today()
PUBLISH_ALL = "--all" in sys.argv

site = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))
env = Environment(loader=FileSystemLoader(ROOT / "templates"), autoescape=False)

_SLOT = ('<ins class="adsbygoogle" style="display:block" data-ad-client="%s" data-ad-format="auto" data-full-width-responsive="true"></ins>'
         '<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>')

# 광고 ID가 없으면 운영 빌드에는 아무것도 넣지 않는다.
# "광고 영역" 자리표시자는 --all(미리보기)에서만 보인다 — 방문자·애드센스 심사자에게 보이면 안 되므로.
AD = (_SLOT % site["adsense_client"]) if site.get("adsense_client") else (
    '<div class="ad">광고 영역 (AdSense)</div>' if PUBLISH_ALL else '')


_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def rfc822(d):
    """RSS가 요구하는 날짜 형식. 발행은 매일 09:00 KST에 이뤄진다."""
    return "%s, %02d %s %d 09:00:00 +0900" % (_DAYS[d.weekday()], d.day, _MONTHS[d.month - 1], d.year)


def write_rss(tests, year):
    """네이버·구글이 새 글을 빨리 가져가도록 RSS 2.0 피드를 만든다."""
    recent = sorted(tests, key=lambda t: t["publish"], reverse=True)[:20]
    L = []
    L.append('<?xml version="1.0" encoding="UTF-8"?>')
    L.append('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">')
    L.append("  <channel>")
    L.append("    <title>%s</title>" % escape(site["name"]))
    L.append("    <link>%s/</link>" % site["url"])
    L.append("    <description>%s</description>" % escape(site["tagline"]))
    L.append("    <language>ko</language>")
    L.append("    <lastBuildDate>%s</lastBuildDate>" % rfc822(TODAY))
    L.append("    <copyright>&#169; %d %s</copyright>" % (year, escape(site["name"])))
    L.append('    <atom:link href="%s/rss.xml" rel="self" type="application/rss+xml"/>' % site["url"])
    for t in recent:
        url = "%s/%s/" % (site["url"], t["slug"])
        L.append("    <item>")
        L.append("      <title>%s</title>" % escape(t["title"]))
        L.append("      <link>%s</link>" % url)
        L.append('      <guid isPermaLink="true">%s</guid>' % url)
        L.append("      <description>%s</description>" % escape(t["description"]))
        L.append("      <category>%s</category>" % escape(t["category"]))
        L.append("      <pubDate>%s</pubDate>" % rfc822(datetime.date.fromisoformat(t["publish"])))
        L.append("    </item>")
    L.append("  </channel>")
    L.append("</rss>")
    (DIST / "rss.xml").write_text(NL.join(L) + NL, encoding="utf-8")


def cat_style(t):
    """검사의 카테고리 색을 --accent로 덮어쓴다. 페이지 전체가 그 색을 따라간다."""
    c = site.get("categories", {}).get(t.get("category"))
    return f'--accent:{c["c"]};--accent-soft:{c["s"]}' if c else ""


def is_new(t):
    d = datetime.date.fromisoformat(t["publish"])
    return 0 <= (TODAY - d).days <= site.get("new_days", 14)


def flatten(t):
    """다차원 검사: 차원별 문항을 번갈아 섞어 t["items"]로 펼친다.
    한 특성의 문항이 연달아 나오면 응답자가 패턴을 눈치채기 때문."""
    dims = t["dimensions"]
    longest = max(len(d["items"]) for d in dims)
    flat = []
    for k in range(longest):
        for di, d in enumerate(dims):
            if k < len(d["items"]):
                it = dict(d["items"][k]); it["d"] = di
                flat.append(it)
    t["items"] = flat


def load_tests():
    """(발행된 검사, 예약된 검사) — 예약분은 홈에 '준비 중'으로만 보여 준다."""
    out, soon = [], []
    for p in sorted((ROOT / "tests").glob("*.json")):
        t = json.loads(p.read_text(encoding="utf-8"))
        if "dimensions" in t:
            flatten(t)
        pub = datetime.date.fromisoformat(t["publish"])
        if PUBLISH_ALL or pub <= TODAY:
            out.append(t)
        else:
            soon.append(t)
            print(f"  (예약) {t['short_name']} → {pub}")
    soon.sort(key=lambda t: t["publish"])
    return out, soon


def cards_html(tests):
    out = []
    for t in tests:
        style = cat_style(t)
        attr = ' style="%s"' % style if style else ""
        badge = '<span class="new">NEW</span>' if is_new(t) else ""
        out.append(
            '<a class="card" href="/%s/"%s><span class="chip">%s</span>%s<b>%s</b>'
            '<p>%s</p><small>%d문항 · 약 %d분</small></a>'
            % (t["slug"], attr, t["category"], badge, t["short_name"],
               t["description"], len(t["items"]), t["minutes"]))
    return '<div class="cards">' + "".join(out) + "</div>"


def jsonld(t):
    url = f"{site['url']}/{t['slug']}/"
    return json.dumps({
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "Article", "headline": t["title"], "description": t["description"],
             "author": {"@type": "Person", "name": site["author"], "url": f"{site['url']}/about/"},
             "publisher": {"@type": "Organization", "name": site["name"], "url": site["url"]},
             "datePublished": t["publish"], "dateModified": t["publish"], "mainEntityOfPage": url},
            {"@type": "FAQPage", "mainEntity": [
                {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}}
                for f in t["faq"]]}]
    }, ensure_ascii=False)


def write(path, html):
    p = DIST / path / "index.html"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(html, encoding="utf-8")


def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    shutil.copytree(ROOT / "static", DIST / "static")

    tests, soon = load_tests()
    year = TODAY.year
    tpl = env.get_template("test.html")
    mtpl = env.get_template("test-multi.html")
    for t in tests:
        related = [r for r in tests if r["slug"] != t["slug"]][:4]
        multi = "dimensions" in t
        if multi:
            n_lab = len(t["labels"])
            tool = {"items": t["items"], "labels": t["labels"], "short_name": t["short_name"],
                    "minutes": t["minutes"],
                    "dims": [{"name": d["name"], "desc": d["desc"],
                              "low_label": d["low_label"], "high_label": d["high_label"],
                              "bands": d["bands"],
                              "offset": d.get("offset", 0),
                              "min": len(d["items"]) - d.get("offset", 0),
                              "max": len(d["items"]) * n_lab - d.get("offset", 0)}
                             for d in t["dimensions"]]}
            if "combo" in t:
                tool["combo"] = t["combo"]
        else:
            tool = {k: t[k] for k in ("items", "labels", "bands", "short_name", "minutes")}
            tool["offset"] = t.get("offset", 0)
            tool["max"] = t["max_score"]
        write(t["slug"], (mtpl if multi else tpl).render(
            t=t, site=site, related=related, ad=AD, year=year,
            jsonld=jsonld(t), tool_json=json.dumps(tool, ensure_ascii=False),
            cat_style=cat_style(t)))
        print(f"  발행  /{t['slug']}/")

    # 고정 페이지
    ptpl = env.get_template("page.html")
    for p in (ROOT / "pages").glob("*.md"):
        head, body = p.read_text(encoding="utf-8").split("---", 1)
        meta = dict(line.split(":", 1) for line in head.strip().splitlines())
        meta = {k.strip(): v.strip() for k, v in meta.items()}
        write(p.stem, ptpl.render(site=site, year=year, slug=p.stem, body=body, ad="", **meta))

    # 검사 목록 + 홈
    cards = cards_html(tests)
    listing = f'<p>{site["tagline"]}. 모든 검사는 무료이며 결과는 저장되지 않습니다.</p>' + cards
    write("tests", ptpl.render(site=site, year=year, slug="tests", title="전체 검사", description=f"{site['name']}의 모든 심리 자가진단 목록", body=listing, ad=AD))
    home_ld = json.dumps({"@context": "https://schema.org", "@type": "WebSite", "name": site["name"], "url": site["url"],
                          "description": site["tagline"]}, ensure_ascii=False)
    (DIST / "index.html").write_text(
        env.get_template("home.html").render(site=site, year=year, tests=tests, soon=soon, cards=cards, ad=AD, jsonld=home_ld), encoding="utf-8")

    # 404 — Cloudflare Pages가 없는 경로에 이 파일을 404 상태로 돌려준다.
    # 없으면 홈이 200으로 나가서 검색엔진이 소프트 404로 본다.
    (DIST / "404.html").write_text(
        env.get_template("404.html").render(site=site, year=year, tests=tests, cards=cards), encoding="utf-8")

    write_rss(tests, year)

    # sitemap / robots
    urls = [""] + ["tests", "about", "privacy", "contact"] + [t["slug"] for t in tests]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
        f"  <url><loc>{site['url']}/{u}{'/' if u else ''}</loc></url>\n" for u in urls) + "</urlset>\n"
    (DIST / "sitemap.xml").write_text(sm, encoding="utf-8")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {site['url']}/sitemap.xml\n", encoding="utf-8")
    print(f"완료: 검사 {len(tests)}개, dist/ 생성")


if __name__ == "__main__":
    main()
