/* 마음놀이 게임 엔진 — 심리학 실험 패러다임을 브라우저에서 해보는 놀이. 서버 없음.
   window.GAME = {slug, short_name, game, types:{key:{name,tag,desc}}}
   game: ultimatum(나누기) | prisoner(믿을까 배신할까) | delay(지금 vs 나중) | wason(카드 4장) | anchor(숫자 끌림) */
(function () {
  var G = window.GAME;
  if (!G) return;
  var stage = document.getElementById("gamebox");
  var head = document.getElementById("gamehead");
  var bar = document.getElementById("gamebar");
  var res = document.getElementById("gameres");

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function btn(label, cls, fn) {
    var b = el("button", cls || "popt", label);
    b.type = "button"; b.onclick = fn;
    return b;
  }
  function won(n) { return n.toLocaleString("ko-KR") + "원"; }
  function progress(i, n, label) {
    head.textContent = label || ((i + 1) + " / " + n);
    bar.style.width = Math.round(i * 100 / n) + "%";
  }
  function clear() { stage.innerHTML = ""; }
  function wait(ms, fn) { setTimeout(fn, ms); }

  // ---------- 결과 화면 (공통) ----------
  function finish(r) {
    // r = {key, stats:[[label,value]], extra:html}
    var ty = G.types[r.key];
    bar.style.width = "100%";
    head.textContent = "결과";
    stage.style.display = "none";
    res.innerHTML = ""; res.style.display = "block";
    res.appendChild(el("p", "pr-k", G.result_k || "나는"));
    res.appendChild(el("b", "pr-n", ty.name));
    res.appendChild(el("p", "pr-t", ty.tag));
    res.appendChild(el("p", "pr-d", ty.desc));
    if (r.stats && r.stats.length) {
      var tb = el("table", "tbl gstats");
      r.stats.forEach(function (s) {
        var tr = el("tr");
        tr.appendChild(el("th", null, s[0]));
        tr.appendChild(el("td", null, s[1]));
        tb.appendChild(tr);
      });
      res.appendChild(tb);
    }
    if (r.extra) res.appendChild(el("div", "gextra", r.extra));

    var bs = el("div", "sharebar");
    bs.appendChild(btn("결과 이미지 저장", "copy", function () {
      if (!window.resultCard) return;
      var cs = getComputedStyle(document.body);
      window.resultCard({
        title: "마음놀이 · " + G.short_name,
        headline: ty.name, sub: ty.tag,
        note: (r.card_note || ""),
        bars: [],
        url: "maumcheck.com" + location.pathname,
        accent: cs.getPropertyValue("--accent").trim(), accentSoft: cs.getPropertyValue("--accent-soft").trim(),
        footer: "마음체크 · 마음놀이는 재미로 하는 놀이입니다",
        fileName: "마음놀이 " + G.short_name
      });
    }));
    bs.appendChild(btn("다시 하기", "copy", start));
    res.appendChild(bs);
    var sr = document.getElementById("snsres");
    if (sr) {
      sr.setAttribute("data-text", G.short_name + " — 나는 " + ty.name + ". 너는?");
      res.appendChild(sr);
    }
    wait(80, function () { res.scrollIntoView({ behavior: "smooth", block: "start" }); });
  }

  // ---------- 1. 나누기 게임 (최후통첩 게임) ----------
  function ultimatum() {
    var offers = [5000, 2000, 4000, 1000, 3000, 500, 4500, 1500];
    var got = [], i = 0;
    function round() {
      if (i >= offers.length) return propose();
      progress(i, offers.length + 1);
      clear();
      var o = offers[i];
      stage.appendChild(el("p", "gnote", "상대가 1만 원을 받았습니다. 어떻게 나눌지는 상대가 정하고, 받을지 말지는 당신이 정합니다. <b>거절하면 둘 다 0원</b>입니다."));
      var sp = el("div", "gsplit");
      sp.appendChild(el("div", "gs me", "<small>나</small><b>" + won(o) + "</b>"));
      sp.appendChild(el("div", "gs you", "<small>상대</small><b>" + won(10000 - o) + "</b>"));
      stage.appendChild(sp);
      var row = el("div", "grow");
      row.appendChild(btn("받는다", "popt", function () { got.push([o, true]); i++; wait(120, round); }));
      row.appendChild(btn("거절한다", "popt", function () { got.push([o, false]); i++; wait(120, round); }));
      stage.appendChild(row);
    }
    function propose() {
      progress(offers.length, offers.length + 1, "마지막 판");
      clear();
      stage.appendChild(el("p", "gnote", "이번엔 <b>당신이</b> 1만 원을 나눕니다. 상대에게 얼마를 줄까요? 상대가 거절하면 둘 다 0원입니다."));
      var row = el("div", "grow wrap");
      [0, 1000, 2000, 3000, 4000, 5000].forEach(function (g) {
        row.appendChild(btn(won(g), "popt", function () { done(g); }));
      });
      stage.appendChild(row);
    }
    function done(give) {
      var acc = got.filter(function (x) { return x[1]; });
      var rej = got.filter(function (x) { return !x[1]; });
      var minAcc = acc.length ? Math.min.apply(null, acc.map(function (x) { return x[0]; })) : null;
      var maxRej = rej.length ? Math.max.apply(null, rej.map(function (x) { return x[0]; })) : null;
      var earned = acc.reduce(function (s, x) { return s + x[0]; }, 0);
      var lost = rej.reduce(function (s, x) { return s + x[0]; }, 0);
      var okProp = give >= 3000; // 컴퓨터 상대는 30% 미만이면 거절한다 (연구에서 흔한 선)
      if (okProp) earned += 10000 - give;
      var key = minAcc === null ? "principle" : minAcc <= 500 ? "calc" : minAcc <= 1500 ? "practical" : minAcc <= 3000 ? "fair" : "principle";
      var mixed = minAcc !== null && maxRej !== null && maxRej > minAcc;
      var extra = "<p><b>마지막 판:</b> 당신은 상대에게 " + won(give) + "을 줬고, 상대는 " +
        (okProp ? "받았습니다. 당신 몫은 " + won(10000 - give) + "." : "<b>거절했습니다.</b> 둘 다 0원.") +
        " 이 게임의 컴퓨터는 3천 원(30%) 미만이면 거절하도록 되어 있었습니다. 실제 실험에서도 20~30%보다 적은 제안은 절반 가까이 거절당합니다.</p>";
      if (mixed) extra += "<p>재미있는 점: 당신은 " + won(minAcc) + "은 받았는데 " + won(maxRej) + "은 거절했습니다. 금액보다 그 순간의 기분이 더 컸다는 뜻입니다. 사람이 실제로 이렇게 움직입니다.</p>";
      finish({
        key: key,
        stats: [["받은 제안", acc.length + " / " + got.length], ["받은 가장 적은 금액", minAcc === null ? "없음" : won(minAcc)],
                ["거절해서 포기한 돈", won(lost)], ["최종으로 번 돈", won(earned)]],
        extra: extra,
        card_note: "거절해서 포기한 돈 " + won(lost)
      });
    }
    round();
  }

  // ---------- 2. 믿을까 배신할까 (반복 죄수의 딜레마) ----------
  function prisoner() {
    var N = 10, r = 0, me = [], ai = [], ps = 0, pa = 0;
    var PAY = { CC: [3, 3], CD: [0, 5], DC: [5, 0], DD: [1, 1] };
    function round(last) {
      if (r >= N) return done();
      head.textContent = "라운드 " + (r + 1);
      bar.style.width = Math.round(r * 100 / N) + "%";
      clear();
      if (last) stage.appendChild(el("p", "glast", last));
      stage.appendChild(el("div", "gscore", "<span>나 <b>" + ps + "</b>점</span><span>상대 <b>" + pa + "</b>점</span>"));
      stage.appendChild(el("p", "gnote", "둘 다 <b>믿으면</b> 3점씩. 둘 다 <b>배신</b>하면 1점씩. 한쪽만 배신하면 배신한 쪽 5점, 믿은 쪽 0점. 몇 라운드인지는 비밀입니다."));
      var row = el("div", "grow");
      row.appendChild(btn("믿는다 (협력)", "popt", function () { play("C"); }));
      row.appendChild(btn("배신한다", "popt", function () { play("D"); }));
      stage.appendChild(row);
    }
    function play(c) {
      var a = r === 0 ? "C" : me[r - 1]; // 컴퓨터는 맞대응: 처음엔 믿고, 그다음엔 내가 지난번에 한 대로
      me.push(c); ai.push(a);
      var p = PAY[c + a]; ps += p[0]; pa += p[1];
      var t = { C: "믿음", D: "배신" };
      var msg = "지난 라운드: 나 " + t[c] + " · 상대 " + t[a] + " → 나 +" + p[0] + ", 상대 +" + p[1];
      r++;
      wait(120, function () { round(msg); });
    }
    function done() {
      var coop = me.filter(function (x) { return x === "C"; }).length;
      var firstD = me.indexOf("D");
      // 상대가 배신한 다음 판에 다시 믿었는지 (용서)
      var forgive = 0, chances = 0;
      for (var i = 1; i < N; i++) if (ai[i] === "D" && i + 1 < N) { chances++; if (me[i + 1] === "C") forgive++; }
      var key = coop === N ? "truster" : coop >= 7 ? "tit" : coop >= 4 ? "opportunist" : "defector";
      var extra = "<p><b>상대의 정체:</b> 이 컴퓨터는 <b>맞대응(Tit for Tat)</b>이었습니다. 첫 판엔 믿고, 그다음부터는 당신이 지난 판에 한 그대로 따라 했습니다. 1980년 정치학자 로버트 액설로드가 연 컴퓨터 대회에서 가장 높은 점수를 낸 바로 그 전략입니다.</p>" +
        "<p>둘 다 끝까지 믿었다면 각자 " + (3 * N) + "점이었습니다. 당신은 " + ps + "점, 상대는 " + pa + "점입니다.</p>";
      if (me[N - 1] === "D" && coop >= N - 2) extra += "<p>마지막 판에만 배신하셨네요. 끝이 보이면 배신하고 싶어지는 것, 게임 이론이 예측하는 그대로입니다. 그래서 라운드 수를 비밀로 했습니다.</p>";
      finish({
        key: key,
        stats: [["믿은 횟수", coop + " / " + N], ["처음 배신한 라운드", firstD < 0 ? "없음" : (firstD + 1) + "라운드"],
                ["상대가 등 돌린 뒤 다시 손 내민 횟수", chances ? forgive + " / " + chances : "해당 없음"], ["내 점수 : 상대 점수", ps + " : " + pa]],
        extra: extra,
        card_note: "믿은 횟수 " + coop + " / " + N + " · 점수 " + ps + "점"
      });
    }
    round();
  }

  // ---------- 3. 지금 vs 나중 (지연 할인) ----------
  function delay() {
    var Xs = [10500, 11000, 12000, 13000, 15000, 17500, 20000];
    var i = 0, waitAt = null, rejected = 0, future = null;
    function round() {
      if (i >= Xs.length || waitAt !== null) return bonus();
      progress(i, Xs.length + 1);
      clear();
      stage.appendChild(el("p", "gnote", "둘 중 하나를 받을 수 있습니다. 진짜 돈이라고 생각하고 골라 주세요."));
      var row = el("div", "grow");
      row.appendChild(btn("<b>지금</b> " + won(10000), "popt", function () { rejected = Xs[i]; i++; wait(120, round); }));
      row.appendChild(btn("<b>한 달 뒤</b> " + won(Xs[i]), "popt", function () { waitAt = Xs[i]; wait(120, round); }));
      stage.appendChild(row);
    }
    function bonus() {
      // 지금 기준으로 거절했던 가장 큰 금액을, 1년 뒤로 미뤄서 다시 물어본다 (현재 편향)
      if (!rejected) return done();
      progress(Xs.length, Xs.length + 1, "보너스 문제");
      clear();
      stage.appendChild(el("p", "gnote", "이번엔 둘 다 <b>먼 미래</b>입니다. 어느 쪽을 고르시겠어요?"));
      var row = el("div", "grow");
      row.appendChild(btn("<b>1년 뒤</b> " + won(10000), "popt", function () { future = "near"; done(); }));
      row.appendChild(btn("<b>1년 1개월 뒤</b> " + won(rejected), "popt", function () { future = "far"; done(); }));
      stage.appendChild(row);
    }
    function done() {
      var rate = waitAt ? Math.round((waitAt - 10000) / 100) : null; // 한 달 이자 %
      var key = rate === null ? "now" : rate <= 10 ? "patient" : rate <= 30 ? "middle" : "soon";
      var extra = "<p>한 달을 기다리는 대가로 당신이 요구한 이자는 <b>" + (rate === null ? "100% 이상" : "한 달에 " + rate + "%") +
        "</b>입니다. 은행 예금 이자는 한 달에 1%도 되지 않습니다. 대부분의 사람이 이 게임에서 은행보다 훨씬 높은 이자를 요구합니다. 사람은 원래 지금을 크게 보도록 생겼습니다.</p>";
      if (future === "far") extra += "<p><b>보너스 문제에서 흥미로운 일이 일어났습니다.</b> 지금 기준으로는 " + won(rejected) + "을 기다리지 않았는데, 1년 뒤로 미뤄 놓으니 같은 한 달을 기다리겠다고 하셨습니다. 기다리는 기간도 금액도 같은데 말입니다. 이것을 <b>현재 편향</b>이라고 합니다. 다이어트는 내일부터, 저축은 다음 달부터가 되는 이유입니다.</p>";
      else if (future === "near") extra += "<p>보너스 문제에서도 일관되게 먼저 받는 쪽을 고르셨습니다. 지금이든 1년 뒤든 기준이 같다는 뜻이고, 이 게임에서 생각보다 드문 쪽입니다.</p>";
      finish({
        key: key,
        stats: [["기다리기 시작한 금액", waitAt ? won(waitAt) : "끝까지 지금"], ["한 달 기다리는 대가", rate === null ? "100% 이상" : rate + "%"]],
        extra: extra,
        card_note: "한 달 기다리는 대가 " + (rate === null ? "100% 이상" : rate + "%")
      });
    }
    round();
  }

  // ---------- 4. 카드 4장 문제 (웨이슨 선택 과제) ----------
  function wason() {
    var P = [
      { rule: "카드의 한쪽 면이 <b>모음</b>이면, 다른 쪽 면은 <b>짝수</b>다.", note: "카드마다 한쪽엔 알파벳, 다른 쪽엔 숫자가 있습니다.",
        cards: ["A", "K", "4", "7"], ans: [0, 3] },
      { rule: "<b>술을 마시는</b> 사람은 <b>만 19세 이상</b>이어야 한다.", note: "카드마다 한쪽엔 마시는 것, 다른 쪽엔 나이가 적혀 있습니다.",
        cards: ["소주", "사이다", "25살", "17살"], ans: [0, 3] }
    ];
    var k = 0, ok = [];
    function round() {
      if (k >= P.length) return done();
      progress(k, P.length);
      clear();
      var p = P[k], sel = [];
      stage.appendChild(el("p", "grule", "규칙: " + p.rule));
      stage.appendChild(el("p", "gnote", p.note + " 이 규칙이 지켜지는지 확인하려면 <b>반드시 뒤집어 봐야 하는 카드</b>를 모두 고르세요. 필요 없는 카드는 고르지 마세요."));
      var row = el("div", "gcards");
      p.cards.forEach(function (c, j) {
        var b = btn(c, "gcard", function () {
          var at = sel.indexOf(j);
          if (at < 0) sel.push(j); else sel.splice(at, 1);
          b.className = "gcard" + (sel.indexOf(j) >= 0 ? " on" : "");
        });
        row.appendChild(b);
      });
      stage.appendChild(row);
      stage.appendChild(btn("이걸로 확인", "task-go", function () {
        if (!sel.length) return;
        var right = sel.length === p.ans.length && p.ans.every(function (a) { return sel.indexOf(a) >= 0; });
        ok.push(right); k++; wait(100, round);
      }));
    }
    function done() {
      var key = ok[0] && ok[1] ? "both" : !ok[0] && ok[1] ? "social" : ok[0] && !ok[1] ? "abstract" : "neither";
      var extra = "<p><b>정답은 둘 다 첫 번째와 네 번째 카드입니다.</b></p>" +
        "<p>첫 문제: <b>A</b>는 뒤가 홀수면 규칙 위반이라 봐야 합니다. <b>7</b>은 뒤가 모음이면 위반이라 봐야 합니다. <b>4</b>는 뒤가 무엇이든 규칙과 상관없습니다. 규칙은 모음이면 짝수라고 했지, 짝수면 모음이라고 하지 않았기 때문입니다. 가장 많이 틀리는 지점이 바로 이 4입니다.</p>" +
        "<p>둘째 문제: <b>소주</b>를 마시는 사람의 나이, <b>17살</b>이 무엇을 마시는지를 확인하면 됩니다. 구조는 첫 문제와 완전히 같습니다.</p>" +
        "<p>첫 문제는 대학생도 열에 하나만 맞힙니다. 그런데 같은 구조를 술과 나이로 바꾸면 대부분 맞힙니다. 사람의 논리는 추상적인 기호보다 <b>규칙을 어기는 사람을 잡아내는 일</b>에 훨씬 밝다는 뜻입니다.</p>";
      finish({
        key: key,
        stats: [["첫 문제 (A K 4 7)", ok[0] ? "정답" : "오답"], ["둘째 문제 (술과 나이)", ok[1] ? "정답" : "오답"]],
        extra: extra,
        card_note: "추상 " + (ok[0] ? "O" : "X") + " · 술과 나이 " + (ok[1] ? "O" : "X")
      });
    }
    round();
  }

  // ---------- 5. 숫자 끌림 (기준점 효과) ----------
  function anchor() {
    var Q = [
      { q: "표준 피아노의 건반은 모두 몇 개일까?", unit: "개", truth: 88, lo: 30, hi: 160 },
      { q: "어른의 몸에 있는 뼈는 몇 개일까?", unit: "개", truth: 206, lo: 90, hi: 380 },
      { q: "아프리카 대륙의 유엔 회원국은 몇 나라일까?", unit: "개국", truth: 54, lo: 18, hi: 110 },
      { q: "간디는 몇 살에 세상을 떠났을까?", unit: "살", truth: 78, lo: 45, hi: 115 },
      { q: "에베레스트산의 높이는 몇 미터일까?", unit: "m", truth: 8849, lo: 4000, hi: 15000 }
    ];
    var k = 0, out = [];
    function round() {
      if (k >= Q.length) return done();
      progress(k, Q.length);
      clear();
      var q = Q[k];
      var high = Math.random() < 0.5;
      var a = high ? q.hi : q.lo;
      stage.appendChild(el("p", "gnote", "먼저 무작위로 숫자 하나를 뽑습니다."));
      var spin = el("div", "gspin", "…");
      stage.appendChild(spin);
      // 횟수가 아니라 시간으로 멈춘다. 백그라운드 탭에선 타이머가 1초 단위로 느려지기 때문.
      var t0 = Date.now();
      var t = setInterval(function () {
        spin.textContent = Math.round(q.lo / 2 + Math.random() * q.hi * 1.2).toLocaleString("ko-KR");
        if (Date.now() - t0 > 700) {
          clearInterval(t);
          spin.textContent = a.toLocaleString("ko-KR");
          spin.className = "gspin done";
          ask(q, a, high);
        }
      }, 70);
    }
    function ask(q, a, high) {
      stage.appendChild(el("p", "pq", q.q));
      stage.appendChild(el("p", "gnote", "뽑힌 숫자 <b>" + a.toLocaleString("ko-KR") + q.unit + "</b>보다 많을까요, 적을까요? 그리고 실제로는 얼마일 것 같나요?"));
      var row = el("div", "grow");
      var side = null;
      var b1 = btn("더 많다", "popt", function () { side = "more"; b1.className = "popt on"; b2.className = "popt"; });
      var b2 = btn("더 적다", "popt", function () { side = "less"; b2.className = "popt on"; b1.className = "popt"; });
      row.appendChild(b1); row.appendChild(b2);
      stage.appendChild(row);
      var inp = el("input", "ginput");
      inp.type = "number"; inp.inputMode = "numeric"; inp.placeholder = "내 추정 (" + q.unit + ")";
      stage.appendChild(inp);
      var err = el("p", "gerr", "");
      stage.appendChild(err);
      stage.appendChild(btn("다음", "task-go", function () {
        var v = Number(inp.value);
        if (!side) { err.textContent = "많다·적다 중 하나를 골라 주세요"; return; }
        if (!inp.value || !(v > 0)) { err.textContent = "숫자를 적어 주세요"; return; }
        out.push({ q: q, a: a, high: high, v: v });
        k++; wait(100, round);
      }));
      inp.focus();
    }
    function done() {
      // 끌림: 높은 숫자를 봤는데 정답보다 높게, 낮은 숫자를 봤는데 정답보다 낮게 적은 경우
      var pulled = out.filter(function (o) { return o.high ? o.v > o.q.truth : o.v < o.q.truth; }).length;
      var key = pulled <= 1 ? "steady" : pulled <= 3 ? "some" : "pulled";
      var rows = out.map(function (o) {
        var dir = o.high ? "높은" : "낮은";
        var p = o.high ? o.v > o.q.truth : o.v < o.q.truth;
        return "<tr><td>" + o.q.q.replace(/\?$/, "") + "</td><td>" + dir + " 숫자 " + o.a.toLocaleString("ko-KR") +
          "</td><td>" + o.v.toLocaleString("ko-KR") + "</td><td>" + o.q.truth.toLocaleString("ko-KR") + o.q.unit + "</td><td>" + (p ? "끌림" : "-") + "</td></tr>";
      }).join("");
      var extra = "<table class=\"tbl gtbl\"><tr><th>문제</th><th>본 숫자</th><th>내 답</th><th>정답</th><th></th></tr>" + rows + "</table>" +
        "<p>방금 본 숫자는 진짜로 무작위였습니다. 문제와 아무 상관이 없다는 걸 알면서도, 사람의 추정은 그 숫자 쪽으로 끌려갑니다. 이것을 <b>기준점 효과</b>(앵커링)라고 합니다. 할인 전 가격, 연봉 협상의 첫 숫자가 힘을 갖는 이유입니다.</p>" +
        "<p>다섯 문제로는 우연도 큽니다. 실제 연구에서는 수십, 수백 명을 높은 숫자 그룹과 낮은 숫자 그룹으로 나눠서 평균을 비교하고, 그러면 차이가 뚜렷하게 나타납니다.</p>";
      finish({
        key: key,
        stats: [["숫자에 끌려간 문제", pulled + " / " + out.length]],
        extra: extra,
        card_note: "숫자에 끌려간 문제 " + pulled + " / " + out.length
      });
    }
    round();
  }

  var RUN = { ultimatum: ultimatum, prisoner: prisoner, delay: delay, wason: wason, anchor: anchor };
  function start() {
    res.style.display = "none";
    stage.style.display = "block";
    RUN[G.game]();
  }
  var go = document.getElementById("gamestart");
  go.onclick = function () {
    go.parentNode.style.display = "none";
    document.getElementById("gamewrap").style.display = "block";
    start();
  };
})();
