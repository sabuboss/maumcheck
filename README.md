# 마음체크 — 심리 자가진단 사이트

## 구조
- `tests/*.json`  검사 하나 = 파일 하나. `publish` 날짜가 오면 자동 발행.
- `pages/*.md`    소개·개인정보처리방침·문의 등 고정 페이지
- `templates/`    페이지 템플릿 (건드릴 일 거의 없음)
- `static/site.css`
- `site.json`     사이트 이름·도메인·작성자·애드센스 ID
- `build.py`      생성 스크립트 → `dist/`

## 로컬 미리보기
    pip install jinja2
    python build.py --all
    python -m http.server -d dist 8000     # http://localhost:8000

## 새 검사 추가
1. `tests/새이름.json` 작성 (rosenberg.json 복사해서 수정)
2. `publish`에 발행일 입력
3. git push → 발행일 아침 9시에 자동으로 올라감

## 배포 흐름
push 또는 매일 09:00 KST → GitHub Actions가 build.py 실행 → `dist` 브랜치에 결과 저장 → Cloudflare Pages가 `dist` 브랜치를 서빙

## Cloudflare Pages 설정
- Production branch: `dist`
- Build command: (비움)
- Build output directory: `/`
