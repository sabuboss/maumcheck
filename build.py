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

_SLOT = ('<ins class="adsbygoogle" style="display:block" data-ad-client="%s" data-ad-slot="%s"'
         ' data-ad-format="auto" data-full-width-responsive="true"></ins>'
         '<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>')

# 본문 안에 넣는 수동 광고 단위는 adsense_slot(광고 단위 ID)이 있을 때만 쓴다.
# data-ad-slot 없는 <ins>는 채워지지 않고 콘솔 오류만 남긴다.
# 슬롯이 없으면 <head>의 스크립트만 들어가고, 자동 광고가 위치를 알아서 정한다.
# "광고 영역" 자리표시자는 --all(미리보기)에서만 보인다 — 방문자와 심사자에게 보이면 안 되므로.
if site.get("adsense_client") and site.get("adsense_slot"):
    AD = _SLOT % (site["adsense_client"], site["adsense_slot"])
elif site.get("adsense_client"):
    AD = ""
else:
    AD = '<div class="ad">광고 영역 (AdSense)</div>' if PUBLISH_ALL else ''


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
    return cat_style_of(t.get("category"))


def cat_meta(cat):
    return site.get("categories", {}).get(cat, {})


def cat_style_of(cat):
    c = cat_meta(cat)
    return f'--accent:{c["c"]};--accent-soft:{c["s"]}' if c.get("c") else ""


def cat_prefix(ts):
    """카테고리 URL. 검사 slug의 앞부분이 곧 카테고리 주소가 된다 (예: depression/ces-d -> /depression/).
    카테고리와 접두사는 1:1로 관리한다."""
    return ts[0]["slug"].split("/")[0]


def group_by_cat(tests):
    """site.json의 카테고리 순서대로 [(카테고리, 주소, [검사...])] 를 돌려준다."""
    by = {}
    for t in tests:
        by.setdefault(t["category"], []).append(t)
    for ts in by.values():
        ts.sort(key=lambda t: t["publish"])
    out = []
    for cat in site.get("categories", {}):
        if cat in by:
            out.append((cat, cat_prefix(by[cat]), by[cat]))
    for cat, ts in by.items():           # site.json에 없는 카테고리도 빠뜨리지 않는다
        if cat not in site.get("categories", {}):
            out.append((cat, cat_prefix(ts), ts))
    return out


def theme_of(cat):
    return cat_meta(cat).get("theme")


def theme_style(key):
    m = site.get("themes", {}).get(key, {})
    return f'--accent:{m["c"]};--accent-soft:{m["s"]}' if m.get("c") else ""


def group_by_theme(groups):
    """카테고리 묶음을 다시 주제로 묶는다. [(키, 메타, [(카테고리, 주소, [검사...])...])]"""
    out = []
    for key, meta in site.get("themes", {}).items():
        inner = [g for g in groups if theme_of(g[0]) == key]
        if inner:
            out.append((key, meta, inner))
    orphan = [g for g in groups if theme_of(g[0]) not in site.get("themes", {})]
    if orphan:
        out.append(("etc", {"name": "그 밖의 주제", "d": ""}, orphan))
    return out


def theme_nav_html(themes, current=None):
    out = []
    for key, meta, inner in themes:
        n = sum(len(ts) for _, _, ts in inner)
        st = theme_style(key)
        attr = ' style="%s"' % st if st else ""
        if key == current:
            out.append('<span class="tchip on"%s>%s <i>%d</i></span>' % (attr, meta["name"], n))
        else:
            out.append('<a class="tchip" href="/%s/"%s>%s <i>%d</i></a>' % (key, attr, meta["name"], n))
    return '<div class="tnav">' + "".join(out) + "</div>"


def cat_nav_html(groups, current=None):
    """주제 칩 목록. 자기 자신은 링크 대신 표시만 한다."""
    out = []
    for cat, pre, ts in groups:
        st = cat_style_of(cat)
        attr = ' style="%s"' % st if st else ""
        if cat == current:
            out.append('<span class="tchip on"%s>%s <i>%d</i></span>' % (attr, cat, len(ts)))
        else:
            out.append('<a class="tchip" href="/%s/"%s>%s <i>%d</i></a>' % (pre, attr, cat, len(ts)))
    return '<div class="tnav">' + "".join(out) + "</div>"


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
        # 같은 주제 → 같은 갈래 → 나머지 순으로 채운다.
        others = [r for r in tests if r["slug"] != t["slug"]]
        th = theme_of(t["category"])
        rank = lambda r: (0 if r["category"] == t["category"]
                          else 1 if theme_of(r["category"]) == th else 2)
        related = sorted(others, key=rank)[:4]
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
            off = t.get("offset", 0)
            # 문항마다 가능한 최소/최대 점수를 실제로 더해 범위를 구한다.
            # scores가 따로 지정된 문항(AUDIT 등)도 섞여 있어서 문항 수로 추정하면 틀린다.
            lo = sum(min(it["scores"]) if "scores" in it else 1 for it in t["items"]) - off
            hi = sum(max(it["scores"]) if "scores" in it else len(it.get("labels", t["labels"]))
                     for it in t["items"]) - off
            if hi != t["max_score"]:
                print(f"  ! {t['slug']}: max_score {t['max_score']} != 실제 {hi}")
            tool["offset"] = off
            tool["min"] = lo
            tool["max"] = t["max_score"]
        write(t["slug"], (mtpl if multi else tpl).render(
            t=t, site=site, related=related, ad=AD, year=year,
            cat_url=t["slug"].split("/")[0],
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

    # 주제 > 카테고리 > 검사, 세 층으로 묶는다
    groups = group_by_cat(tests)
    themes = group_by_theme(groups)
    CAT_MIN = 2   # 검사가 이만큼 안 되는 카테고리는 내용이 얇아서 색인에서 뺀다 (링크는 그대로 동작)
    indexed_cats = [(c, pre) for c, pre, ts in groups if len(ts) >= CAT_MIN]

    # 1) 카테고리 페이지 — /depression/ 처럼 검사 주소의 윗단계가 그대로 주소가 된다
    for cat, pre, ts in groups:
        d = cat_meta(cat).get("d", "")
        tkey = theme_of(cat)
        tname = site.get("themes", {}).get(tkey, {}).get("name", "")
        body = [f'<p class="lead">{d}</p>' if d else "", cards_html(ts)]
        if len(ts) < CAT_MIN:
            body.append('<p class="note">이 주제는 아직 검사가 하나뿐입니다. '
                        '<b>자유롭게 쓸 수 있는 척도만 올린다</b>는 기준을 지키다 보니 천천히 늘어납니다. '
                        f'비슷한 주제는 <a href="/{tkey}/">{tname}</a>에서 함께 보실 수 있습니다.</p>')
        body.append("<h2>같은 갈래의 다른 주제</h2>")
        body.append(cat_nav_html([g for g in groups if theme_of(g[0]) == tkey], current=cat))
        crumb = (f'<div class="crumb"><a href="/">홈</a> &rsaquo; <a href="/tests/">전체 검사</a>'
                 f' &rsaquo; <a href="/{tkey}/">{tname}</a> &rsaquo; {cat}</div>')
        write(pre, ptpl.render(
            site=site, year=year, slug=pre, title=f"{cat} 검사",
            description=f"{cat} 관련 무료 심리 자가진단 {len(ts)}종. {d}",
            crumb=crumb, cat_style=cat_style_of(cat), body="".join(body), ad=AD,
            robots=None if len(ts) >= CAT_MIN else "noindex,follow"))

    # 2) 주제 페이지 — 카테고리 여러 개를 묶어 실제로 읽을거리가 되는 층
    for key, meta, inner in themes:
        n = sum(len(ts) for _, _, ts in inner)
        body = [f'<p class="lead">{meta["d"]}</p>']
        for cat, pre, ts in inner:
            d = cat_meta(cat).get("d", "")
            st = cat_style_of(cat)
            attr = f' style="{st}"' if st else ""
            body.append(f'<section class="topic"{attr}><h2><a href="/{pre}/">{cat}</a></h2>'
                        f'{f"<p>{d}</p>" if d else ""}{cards_html(ts)}</section>')
        body.append("<h2>다른 갈래</h2>")
        body.append(theme_nav_html(themes, current=key))
        crumb = f'<div class="crumb"><a href="/">홈</a> &rsaquo; <a href="/tests/">전체 검사</a> &rsaquo; {meta["name"]}</div>'
        write(key, ptpl.render(
            site=site, year=year, slug=key, title=meta["name"],
            description=f"{meta['name']} — 무료 심리 자가진단 {n}종을 모았습니다. "
                        f"{', '.join(c for c, _, _ in inner)} 주제를 다룹니다.",
            crumb=crumb, cat_style=theme_style(key), body="".join(body), ad=AD))
        print(f"  갈래  /{key}/  ({meta['name']}, 카테고리 {len(inner)}개 · 검사 {n}개)")

    # 3) 전체 검사 — 갈래별로 묶어서 보여 준다
    cards = cards_html(tests)
    sections = [f'<p>{site["tagline"]}. 모든 검사는 무료이며 결과는 저장되지 않습니다. '
                f'지금 <b>{len(tests)}종</b>이 <b>{len(themes)}개 갈래</b>, '
                f'<b>{len(groups)}개 주제</b>로 나뉘어 있습니다.</p>',
                theme_nav_html(themes)]
    for key, meta, inner in themes:
        n = sum(len(ts) for _, _, ts in inner)
        st = theme_style(key)
        attr = f' style="{st}"' if st else ""
        sections.append(f'<section class="theme"{attr}><h2><a href="/{key}/">{meta["name"]}</a>'
                        f'<span class="cnt">검사 {n}종</span></h2>')
        sections.append(cat_nav_html(inner))
        # 카테고리별로 그리드를 쪼개면 카드가 한 줄씩 떨어진다. 갈래 단위로 한 번에 깐다.
        sections.append(cards_html([t for _, _, ts in inner for t in ts]))
        sections.append("</section>")
    write("tests", ptpl.render(site=site, year=year, slug="tests", title="전체 검사",
        description=f"{site['name']}의 심리 자가진단 {len(tests)}종을 {len(themes)}개 갈래로 묶었습니다. "
                    f"우울·불안 같은 지금의 상태부터 성격, 관계까지 학계에서 검증되고 무료로 공개된 척도만 다룹니다.",
        body="".join(sections), ad=AD))

    # 홈
    home_ld = json.dumps({"@context": "https://schema.org", "@type": "WebSite", "name": site["name"],
                          "url": site["url"], "description": site["tagline"]}, ensure_ascii=False)
    (DIST / "index.html").write_text(
        env.get_template("home.html").render(site=site, year=year, tests=tests, soon=soon,
                                             cards=cards, themes=themes, theme_nav=theme_nav_html(themes),
                                             ad=AD, jsonld=home_ld), encoding="utf-8")

    # 404 — Cloudflare Pages가 없는 경로에 이 파일을 404 상태로 돌려준다.
    # 없으면 홈이 200으로 나가서 검색엔진이 소프트 404로 본다.
    (DIST / "404.html").write_text(
        env.get_template("404.html").render(site=site, year=year, tests=tests, cards=cards), encoding="utf-8")

    write_rss(tests, year)

    # sitemap / robots
    urls = ([""] + ["tests", "about", "privacy", "contact"]
            + [k for k, _, _ in themes]
            + [pre for _, pre in indexed_cats] + [t["slug"] for t in tests])
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
        f"  <url><loc>{site['url']}/{u}{'/' if u else ''}</loc></url>\n" for u in urls) + "</urlset>\n"
    (DIST / "sitemap.xml").write_text(sm, encoding="utf-8")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {site['url']}/sitemap.xml\n", encoding="utf-8")

    # 보안 헤더 — Cloudflare Pages는 출력 루트의 _headers 파일을 읽는다.
    # CSP는 넣지 않는다. 애드센스가 광고를 iframe과 스크립트로 계속 바꿔 불러오기 때문에
    # 잘못 조이면 광고가 통째로 안 뜬다. 클릭재킹(X-Frame-Options)은 애드센스에서
    # 특히 중요하다 — 남이 이 사이트를 iframe으로 감싸 노출수를 만들면 무효 트래픽이 된다.
    (DIST / "_headers").write_text(NL.join([
        "/*",
        "  Strict-Transport-Security: max-age=31536000; includeSubDomains",
        "  X-Frame-Options: SAMEORIGIN",
        "  X-Content-Type-Options: nosniff",
        "  Referrer-Policy: strict-origin-when-cross-origin",
        "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        "",
    ]), encoding="utf-8")

    # ads.txt — site.json에 adsense_client(ca-pub-...)가 들어오면 자동 생성된다.
    # ID 없이 빈 파일을 올리면 오히려 경고가 뜨므로 있을 때만 쓴다.
    pub = site.get("adsense_client", "").replace("ca-pub-", "")
    if pub:
        (DIST / "ads.txt").write_text(
            "google.com, pub-%s, DIRECT, f08c47fec0942fa0%s" % (pub, NL), encoding="utf-8")
    print(f"완료: 검사 {len(tests)}개 · 갈래 {len(themes)}개 · 주제 {len(groups)}개(색인 {len(indexed_cats)}개)")


if __name__ == "__main__":
    main()
