/* 결과 이미지 카드 — 브라우저 안에서 캔버스로 그려서 저장/공유한다. 서버 없음.
   window.resultCard({ title, headline, sub, note, bars:[{label, pct, text}], url, accent, accentSoft }) */
(function () {
  var W = 1080, H = 1350; // 인스타 피드·스토리 둘 다 잘리지 않는 4:5
  var BG = "#f6f1e7", INK = "#1f2a2e", GREY = "#8a8f88", MARK = "#ffd84d";
  var FONT = '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif';

  function toast(m) {
    var t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = m; t.className = "toast show";
    setTimeout(function () { t.className = "toast"; }, 2200);
  }

  function wrap(ctx, text, maxw) {
    var words = String(text).split(/\s+/), lines = [], cur = "";
    words.forEach(function (w) {
      var cand = cur ? cur + " " + w : w;
      if (ctx.measureText(cand).width <= maxw) { cur = cand; return; }
      if (cur) lines.push(cur);
      cur = w;
      while (ctx.measureText(cur).width > maxw && cur.length > 1) {
        var k = cur.length;
        while (k > 1 && ctx.measureText(cur.slice(0, k)).width > maxw) k--;
        lines.push(cur.slice(0, k)); cur = cur.slice(k);
      }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function fitFont(ctx, text, maxw, sizes, weight, maxLines) {
    for (var i = 0; i < sizes.length; i++) {
      ctx.font = weight + " " + sizes[i] + "px " + FONT;
      var lines = wrap(ctx, text, maxw);
      if (lines.length <= maxLines) return { size: sizes[i], lines: lines };
    }
    ctx.font = weight + " " + sizes[sizes.length - 1] + "px " + FONT;
    return { size: sizes[sizes.length - 1], lines: wrap(ctx, text, maxw).slice(0, maxLines) };
  }

  function center(ctx, text, y, color) {
    ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(text, W / 2, y);
  }

  function roundRect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
  }

  function draw(d) {
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var ctx = c.getContext("2d");
    var accent = d.accent || "#1d6f63", soft = d.accentSoft || "#dff1ec";
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    // 위쪽 띠
    ctx.fillStyle = accent; ctx.fillRect(0, 0, W, 18);

    var y = 150;
    ctx.font = "700 36px " + FONT; center(ctx, d.title, y, accent);

    // 큰 결과 (점수 또는 유형)
    y += 70;
    var h = fitFont(ctx, d.headline, W - 160, [150, 128, 110, 96, 84, 72], "800", 2);
    h.lines.forEach(function (ln) { y += h.size * 0.95; center(ctx, ln, y, INK); });

    // 구간 라벨 (노란 밑줄)
    if (d.sub) {
      y += 90;
      ctx.font = "700 52px " + FONT;
      var sw = ctx.measureText(d.sub).width;
      ctx.fillStyle = MARK; ctx.fillRect(W / 2 - sw / 2 - 14, y - 16, sw + 28, 26);
      center(ctx, d.sub, y, INK);
    }

    // 막대들 (단일 점수는 1개, 다차원은 여러 개)
    if (d.bars && d.bars.length) {
      y += 90;
      var bw = W - 200, bx = 100, bh = d.bars.length > 1 ? 22 : 30;
      d.bars.forEach(function (b) {
        if (d.bars.length > 1) {
          ctx.font = "700 34px " + FONT; ctx.textAlign = "left"; ctx.fillStyle = INK;
          ctx.fillText(b.label, bx, y);
          if (b.text) { ctx.font = "500 30px " + FONT; ctx.textAlign = "right"; ctx.fillStyle = GREY; ctx.fillText(b.text, bx + bw, y); }
          y += 18;
        }
        roundRect(ctx, bx, y, bw, bh, bh / 2, "#e6e1d6");
        var fw = Math.max(bh, Math.round(bw * Math.min(100, Math.max(0, b.pct)) / 100));
        roundRect(ctx, bx, y, fw, bh, bh / 2, b.color || accent);
        y += bh + (d.bars.length > 1 ? 52 : 0);
      });
      if (d.bars.length === 1) {
        y += 44; ctx.font = "500 28px " + FONT; ctx.fillStyle = GREY;
        ctx.textAlign = "left"; ctx.fillText(d.bars[0].lo || "", bx, y);
        ctx.textAlign = "right"; ctx.fillText(d.bars[0].hi || "", bx + bw, y);
      }
    }

    // 한 줄 메모
    if (d.note) {
      y += 90;
      var n = fitFont(ctx, d.note, W - 200, [34, 30, 27], "500", 3);
      n.lines.forEach(function (ln) { center(ctx, ln, y, INK); y += n.size * 1.5; });
    }

    // 바닥: 주소 + 나도 해보기
    roundRect(ctx, 0, H - 170, W, 170, 0, soft);
    ctx.font = "700 34px " + FONT; center(ctx, "나도 해보기 →  " + (d.url || "maumcheck.com"), H - 95, accent);
    ctx.font = "500 26px " + FONT; center(ctx, d.footer || "마음체크 · 참고용 자기 이해 도구, 진단이 아닙니다", H - 48, GREY);
    return c;
  }

  function save(canvas, name) {
    canvas.toBlob(function (blob) {
      if (!blob) { toast("이미지를 만들지 못했어요"); return; }
      var file;
      try { file = new File([blob], name + ".png", { type: "image/png" }); } catch (e) {}
      // 모바일: 공유창(인스타·카톡·저장)이 가장 자연스럽다
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && window.matchMedia("(pointer:coarse)").matches) {
        navigator.share({ files: [file], title: name }).catch(function () {});
        return;
      }
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name + ".png";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      toast("이미지를 저장했어요");
    }, "image/png");
  }

  window.resultCard = function (d) {
    try { save(draw(d), (d.fileName || "마음체크 결과")); }
    catch (e) { toast("이미지를 만들지 못했어요"); }
  };
})();
