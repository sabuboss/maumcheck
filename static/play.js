/* 마음놀이 엔진 — 한 문항씩 넘기고, 축별 다수결로 유형을 고른다.
   window.PLAY = {slug, short_name, axes:[{key,name,a,b}], questions:[{q,axis,opts:[[text,v]]}], types:{"101":{...}}, pair:[{same,diff,both0}]} */
(function () {
  var P = window.PLAY;
  if (!P) return;
  var box = document.getElementById("playbox");
  var res = document.getElementById("playres");
  var head = document.getElementById("playhead");
  var bar = document.getElementById("playbar");
  var ans = [];
  var PEER = null;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function toast(m) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = m; t.className = "toast show";
    setTimeout(function () { t.className = "toast"; }, 1800);
  }

  // 친구가 보낸 링크: #p=101
  function readPeer() {
    PEER = null;
    var m = location.hash.match(/(?:^#|&)p=([01]{3})/);
    if (m && P.types[m[1]]) PEER = m[1];
    var pb = document.getElementById("peerbar");
    if (!pb) return;
    if (PEER) {
      var nm = P.types[PEER].name;
      // 받침이 있으면 "이었어요"(펭귄이었어요), 없으면 "였어요"(멧돼지였어요)
      var last = nm.charCodeAt(nm.length - 1) - 0xac00;
      var jong = last >= 0 && last < 11172 && last % 28 !== 0;
      pb.innerHTML = "친구는 <b>" + nm + "</b>" + (jong ? "이었어요" : "였어요") + ". 나도 해보고 둘을 비교해 보세요.";
      pb.style.display = "block";
    } else pb.style.display = "none";
  }

  function show(i) {
    var q = P.questions[i];
    head.textContent = (i + 1) + " / " + P.questions.length;
    bar.style.width = Math.round(i * 100 / P.questions.length) + "%";
    box.innerHTML = "";
    box.appendChild(el("p", "pq", q.q));
    var opts = el("div", "popts");
    q.opts.forEach(function (o) {
      var b = el("button", "popt", o[0]);
      b.type = "button";
      b.onclick = function () {
        ans[i] = o[1];
        b.className = "popt on";
        setTimeout(function () {
          if (i + 1 < P.questions.length) show(i + 1);
          else finish();
        }, 180);
      };
      opts.appendChild(b);
    });
    box.appendChild(opts);
    if (i > 0) {
      var back = el("button", "pback", "← 이전");
      back.type = "button";
      back.onclick = function () { show(i - 1); };
      box.appendChild(back);
    }
  }

  function tally() {
    var cnt = P.axes.map(function () { return [0, 0]; });
    P.questions.forEach(function (q, i) { cnt[q.axis][ans[i]]++; });
    return cnt;
  }

  function finish() {
    var cnt = tally();
    var key = cnt.map(function (c) { return c[1] > c[0] ? "1" : "0"; }).join("");
    var ty = P.types[key];
    bar.style.width = "100%";
    head.textContent = "결과";
    box.style.display = "none";
    res.innerHTML = "";
    res.style.display = "block";

    res.appendChild(el("p", "pr-k", "스트레스 받으면 나는"));
    res.appendChild(el("b", "pr-n", ty.name));
    res.appendChild(el("p", "pr-t", ty.tag));
    res.appendChild(el("p", "pr-d", ty.desc));

    var ul = el("ul", "pr-list");
    ul.appendChild(el("li", null, "<b>강점</b>" + ty.good));
    ul.appendChild(el("li", null, "<b>조심할 것</b>" + ty.watch));
    ul.appendChild(el("li", null, "<b>이렇게 해보세요</b>" + ty.tip));
    res.appendChild(ul);

    // 축별 막대
    var ax = el("div", "pr-axes");
    P.axes.forEach(function (a, i) {
      var n = cnt[i][0] + cnt[i][1];
      var row = el("div", "pr-ax");
      row.appendChild(el("span", "l", a.a));
      var tr = el("div", "tr");
      var fill = el("i");
      fill.style.width = Math.round(cnt[i][1] * 100 / n) + "%";
      tr.appendChild(fill);
      row.appendChild(tr);
      row.appendChild(el("span", "r", a.b));
      ax.appendChild(row);
    });
    res.appendChild(ax);

    // 친구와 비교
    if (PEER) {
      var pt = P.types[PEER];
      var cmp = el("div", "pr-cmp");
      cmp.appendChild(el("p", "h", "나 <b>" + ty.name + "</b> · 친구 <b>" + pt.name + "</b>"));
      P.axes.forEach(function (a, i) {
        var me = key[i], you = PEER[i];
        var txt = me !== you ? P.pair[i].diff : (me === "1" ? P.pair[i].same : P.pair[i].both0);
        cmp.appendChild(el("p", null, "<b>" + a.name + "</b> — " + txt));
      });
      res.appendChild(cmp);
    }

    var btns = el("div", "sharebar");
    var save = el("button", "copy", "결과 이미지 저장");
    save.type = "button";
    save.onclick = function () {
      if (!window.resultCard) return;
      var cs = getComputedStyle(document.body);
      window.resultCard({
        title: "마음놀이 · " + P.short_name,
        headline: ty.name,
        sub: ty.tag,
        note: ty.good,
        bars: P.axes.map(function (a, i) {
          var n = cnt[i][0] + cnt[i][1];
          return { label: a.a + " ↔ " + a.b, text: cnt[i][1] > cnt[i][0] ? a.b : a.a,
                   pct: Math.round(cnt[i][1] * 100 / n) };
        }),
        url: "maumcheck.com" + location.pathname,
        accent: cs.getPropertyValue("--accent").trim(), accentSoft: cs.getPropertyValue("--accent-soft").trim(),
        footer: "마음체크 · 마음놀이는 재미로 하는 놀이입니다",
        fileName: "마음놀이 " + ty.name
      });
    };
    var link = el("button", "copy", "친구랑 비교할 링크");
    link.type = "button";
    link.onclick = function () {
      var url = location.href.split("#")[0] + "#p=" + key;
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast("링크를 복사했어요. 친구에게 보내세요"); });
      else prompt("아래 링크를 친구에게 보내세요", url);
    };
    var again = el("button", "copy", "다시 하기");
    again.type = "button";
    again.onclick = start;
    btns.appendChild(save); btns.appendChild(link); btns.appendChild(again);
    res.appendChild(btns);

    var sr = document.getElementById("snsres");
    if (sr) {
      sr.setAttribute("data-text", "스트레스 받으면 나는 " + ty.name + " — 너는 어떤 동물?");
      sr.style.display = "";
      res.appendChild(sr);
    }
    setTimeout(function () { res.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80);
  }

  function start() {
    ans = [];
    res.style.display = "none";
    box.style.display = "block";
    show(0);
  }

  readPeer();
  window.addEventListener("hashchange", function () { readPeer(); });
  var go = document.getElementById("playstart");
  go.onclick = function () {
    go.parentNode.style.display = "none";
    document.getElementById("playwrap").style.display = "block";
    start();
  };
})();
