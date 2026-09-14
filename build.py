#!/usr/bin/env python3
"""tests/*.json + pages/*.md -> dist/  (정적 사이트 생성)

사용법:
  python build.py            # 오늘 날짜 기준, publish <= 오늘 인 검사만 발행
  python build.py --all      # 날짜 무시하고 전부 발행 (미리보기용)
"""
import json, sys, shutil, datetime, pathlib
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


def load_tests():
    out = []
    for p in sorted((ROOT / "tests").glob("*.json")):
        t = json.loads(p.read_text(encoding="utf-8"))
        pub = datetime.date.fromisoformat(t["publish"])
        if PUBLISH_ALL or pub <= TODAY:
            out.append(t)
        else:
            print(f"  (예약) {t['short_name']} → {pub}")
    return out


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

    tests = load_tests()
    year = TODAY.year
    tpl = env.get_template("test.html")
    for t in tests:
        related = [r for r in tests if r["slug"] != t["slug"]][:4]
        tool = {k: t[k] for k in ("items", "labels", "bands", "short_name", "minutes")}
        write(t["slug"], tpl.render(t=t, site=site, related=related, ad=AD, year=year,
                                    jsonld=jsonld(t), tool_json=json.dumps(tool, ensure_ascii=False)))
        print(f"  발행  /{t['slug']}/")

    # 고정 페이지
    ptpl = env.get_template("page.html")
    for p in (ROOT / "pages").glob("*.md"):
        head, body = p.read_text(encoding="utf-8").split("---", 1)
        meta = dict(line.split(":", 1) for line in head.strip().splitlines())
        meta = {k.strip(): v.strip() for k, v in meta.items()}
        write(p.stem, ptpl.render(site=site, year=year, slug=p.stem, body=body, ad="", **meta))

    # 검사 목록 + 홈
    cards = "".join(
        f'<a href="/{t["slug"]}/">{t["short_name"]}<small>{t["category"]} · {len(t["items"])}문항 · {t["minutes"]}분</small></a>'
        for t in tests)
    listing = f'<p>{site["tagline"]}. 모든 검사는 무료이며 결과는 저장되지 않습니다.</p><div class="related">{cards}</div>'
    write("tests", ptpl.render(site=site, year=year, slug="tests", title="전체 검사", description=f"{site['name']}의 모든 심리 자가진단 목록", body=listing, ad=AD))
    (DIST / "index.html").write_text(
        ptpl.render(site=site, year=year, slug="", title=site["name"], description=site["tagline"], body=listing, ad=AD), encoding="utf-8")

    # sitemap / robots
    urls = [""] + ["tests", "about", "privacy", "contact"] + [t["slug"] for t in tests]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
        f"  <url><loc>{site['url']}/{u}{'/' if u else ''}</loc></url>\n" for u in urls) + "</urlset>\n"
    (DIST / "sitemap.xml").write_text(sm, encoding="utf-8")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {site['url']}/sitemap.xml\n", encoding="utf-8")
    print(f"완료: 검사 {len(tests)}개, dist/ 생성")


if __name__ == "__main__":
    main()
