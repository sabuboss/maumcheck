"""공유 미리보기 이미지(og:image) — 빌드 때 페이지마다 1200×630 PNG 한 장을 만든다.

카톡·SNS에 링크를 보내면 이 그림이 뜬다. 페이지 제목은 학술 용어 위주라서
그림에는 사람들이 실제로 검색하는 말(short_name)을 크게 쓴다.
글꼴은 assets/fonts/Pretendard-Bold.otf 를 함께 둔다 — 빌드가 GitHub Actions(리눅스)에서 돌기
때문에 시스템 글꼴에 기대면 한글이 네모로 깨진다. Pretendard는 SIL OFL 1.1.
"""
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG, INK, ACCENT, NUM, MARK, GREY = "#f6f1e7", "#1f2a2e", "#1d6f63", "#c2410c", "#ffd84d", "#8a8f88"
FONT = Path(__file__).parent / "assets" / "fonts" / "Pretendard-Bold.otf"
MAXW = W - 2 * 80  # 좌우 여백 80px


def font(size):
    return ImageFont.truetype(str(FONT), size)


def wrap(text, f, maxw):
    """띄어쓰기 단위로 줄을 채우고, 한 단어가 한 줄을 넘으면 글자 단위로 끊는다."""
    lines, cur = [], ""
    for word in text.split():
        cand = (cur + " " + word).strip()
        if f.getlength(cand) <= maxw:
            cur = cand
            continue
        if cur:
            lines.append(cur)
        cur = word
        while f.getlength(cur) > maxw:
            k = len(cur)
            while k > 1 and f.getlength(cur[:k]) > maxw:
                k -= 1
            lines.append(cur[:k])
            cur = cur[k:]
    if cur:
        lines.append(cur)
    return lines


def fit(text, sizes, max_lines):
    """큰 글자부터 시도해서 줄 수 안에 들어오는 첫 크기를 쓴다."""
    for s in sizes:
        f = font(s)
        lines = wrap(text, f, MAXW)
        if len(lines) <= max_lines:
            return f, lines
    f = font(sizes[-1])
    return f, wrap(text, f, MAXW)[:max_lines]


def draw_center(d, y, text, f, color, num_color=None):
    """가운데 정렬로 한 줄. num_color를 주면 숫자만 그 색으로 — '16유형', '5요인' 같은 데서 숫자가 튄다."""
    parts = [p for p in re.split(r"(\d+)", text) if p] if num_color else [text]
    total = sum(f.getlength(p) for p in parts)
    x = (W - total) / 2
    for p in parts:
        d.text((x, y), p, font=f, fill=(num_color if num_color and p.isdigit() else color))
        x += f.getlength(p)


def render(path, title, tag, sub, foot="maumcheck.com", max_lines=2):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)

    tf = font(34)
    tf_h = 34 * 1.2
    sizes = (100, 92, 84, 76, 68, 60, 52) if max_lines <= 2 else (76, 68, 60, 54, 48)
    hf, lines = fit(title, sizes, max_lines)
    lh = hf.size * 1.18
    sf = font(44)
    sf_h = 44 * 1.25

    gap1, gap2 = 22, 34
    block = tf_h + gap1 + lh * len(lines) + (gap2 + sf_h if sub else 0)
    y = (H - block) / 2 - 10  # 하단 푸터 몫만큼 살짝 위로

    draw_center(d, y, tag, tf, ACCENT)
    y += tf_h + gap1
    for ln in lines:
        draw_center(d, y, ln, hf, INK, num_color=NUM)
        y += lh
    if sub:
        y += gap2
        w = sf.getlength(sub)
        x0 = (W - w) / 2
        # 노란 밑줄: 글자 아랫부분 뒤에 깔리는 띠
        band_top = y + sf_h * 0.55
        d.rectangle([x0 - 10, band_top, x0 + w + 10, band_top + 22], fill=MARK)
        d.text((x0, y), sub, font=sf, fill=INK)

    ff = font(26)
    d.text(((W - ff.getlength(foot)) / 2, H - 34 - 26), foot, font=ff, fill=GREY)

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG", optimize=True)
