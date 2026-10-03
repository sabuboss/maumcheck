/* 인지 과제 공통 엔진.
 *
 * 설문 검사(test.html)와 달리 과제는 시간과 입력을 직접 다룬다.
 * 과제 종류는 T.kind 로 갈린다 — "rt"(반응시간), "span"(기억 폭).
 *
 * 설계에서 지키는 것:
 *  - 남과 비교하지 않는다. 백분위도 등급도 띄우지 않는다.
 *    브라우저와 기기에 따라 반응시간이 8~67ms씩 밀린다는 실측이 있다
 *    (Anwyl-Irvine et al., 2021). 절대 비교는 능력이 아니라 기기를 재는 꼴이 된다.
 *  - 기록은 이 기기의 localStorage에만 남는다. 서버로 가지 않는다.
 *  - 저장이 막힌 환경(시크릿 모드 등)에서도 과제 자체는 그대로 돌아가야 한다.
 */
(function () {
  "use strict";

  var T = window.TASK;
  if (!T) return;

  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage");      // 과제가 그려지는 영역
  var head = $("taskhead");    // 진행 상황 표시
  var res = $("taskres");      // 결과 영역

  // ── 기록 저장 ────────────────────────────────────────────
  // 최근 5회만. 날짜와 점수뿐이고 식별 정보는 담지 않는다.
  var KEY = "mc.task." + T.slug;

  function loadHistory() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var v = JSON.parse(raw);
      return Object.prototype.toString.call(v) === "[object Array]" ? v : [];
    } catch (e) {
      return [];   // 저장이 막혀 있어도 과제는 계속된다
    }
  }

  function saveHistory(entry) {
    try {
      var h = loadHistory();
      h.push(entry);
      while (h.length > 5) h.shift();
      localStorage.setItem(KEY, JSON.stringify(h));
      return h;
    } catch (e) {
      return null;  // 저장 실패를 사용자에게 알리지 않는다. 결과는 이미 화면에 있다
    }
  }

  function today() {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  // ── 화면 도우미 ──────────────────────────────────────────
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function setHead(text) { head.textContent = text || ""; }

  function bigButton(label, onClick) {
    var b = el("button", "task-go", label);
    b.onclick = onClick;
    return b;
  }

  // 중앙값. 평균보다 튀는 값에 덜 흔들린다.
  function median(arr) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  }

  // ── 결과 공통 ────────────────────────────────────────────
  // metric: 이번 기록(비교에 쓰는 숫자), lowerIsBetter: 작을수록 좋은가
  function showResult(rows, metric, lowerIsBetter, note) {
    var prev = loadHistory();
    var best = null;
    for (var i = 0; i < prev.length; i++) {
      if (best === null) best = prev[i].v;
      else best = lowerIsBetter ? Math.min(best, prev[i].v) : Math.max(best, prev[i].v);
    }
    var last = prev.length ? prev[prev.length - 1].v : null;

    clear(res);
    res.style.display = "block";

    var t = el("h3", null, "결과");
    res.appendChild(t);

    var tbl = el("table", "tbl");
    for (var r = 0; r < rows.length; r++) {
      var tr = el("tr");
      tr.appendChild(el("th", null, rows[r][0]));
      tr.appendChild(el("td", null, rows[r][1]));
      tbl.appendChild(tr);
    }
    res.appendChild(tbl);

    // 지난 기록과의 비교 — 남과 비교하지 않고 나하고만 비교한다
    if (last !== null) {
      var d = metric - last;
      var improved = lowerIsBetter ? d < 0 : d > 0;
      var same = d === 0;
      var p = el("p", "task-cmp");
      if (same) {
        p.textContent = "지난번과 같습니다.";
      } else {
        p.textContent = "지난번(" + last + T.unit + ")보다 "
          + Math.abs(d) + T.unit + " " + (improved ? "나아졌습니다." : "떨어졌습니다.");
        p.className = "task-cmp " + (improved ? "up" : "down");
      }
      res.appendChild(p);
      if (best !== null) {
        res.appendChild(el("p", "task-best", "이 기기에 남은 최고 기록: " + best + T.unit));
      }
    } else {
      res.appendChild(el("p", "task-cmp", "이 기기의 첫 기록입니다. 다시 해보시면 지난번과 비교해 드립니다."));
    }

    if (note) {
      var n = el("p", "task-note");
      n.innerHTML = note;
      res.appendChild(n);
    }

    // 비교 금지 문구. 과제마다 이유가 달라서 JSON에서 넘기고, 없으면 반응시간용 기본 문구를 쓴다.
    var warn = el("p", "task-note");
    warn.innerHTML = T.warn || ("이 숫자는 <b>다른 사람과 비교하는 용도가 아닙니다.</b> "
      + "브라우저와 기기에 따라 수십 밀리초가 밀리기 때문에, 같은 사람도 기기를 바꾸면 결과가 달라집니다. "
      + "<b>같은 기기에서 내 기록이 어떻게 달라지는지</b>만 보세요.");
    res.appendChild(warn);

    saveHistory({ d: today(), v: metric });

    var again = bigButton("다시 하기", function () { start(); });
    again.className = "task-go again";
    res.appendChild(again);

    setTimeout(function () { res.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
  }

  // ════════════════════════════════════════════════════════
  //  반응시간 과제
  // ════════════════════════════════════════════════════════
  function runRT() {
    var cfg = T.task;
    var trials = [];        // 본시행 반응시간
    var early = 0;          // 성급한 반응 횟수
    var idx = 0;            // 전체 시행 번호(연습 포함)
    var total = cfg.practice + cfg.trials;
    var armed = false;      // 자극이 떴는가
    var shownAt = 0;        // 자극이 실제로 그려진 시각
    var timer = null;

    var pad = el("div", "rt-pad");
    var msg = el("div", "rt-msg");
    pad.appendChild(msg);

    function isPractice() { return idx < cfg.practice; }

    function label() {
      return isPractice()
        ? "연습 " + (idx + 1) + " / " + cfg.practice
        : "본시행 " + (idx - cfg.practice + 1) + " / " + cfg.trials;
    }

    function wait() {
      armed = false;
      pad.className = "rt-pad";
      msg.textContent = "초록색이 되면 누르세요";
      setHead(label());
      // 탭이 가려져 있으면 자극을 띄우지 않고 돌아올 때까지 기다린다.
      // 안 보이는 화면에서 잰 시간은 의미가 없다.
      if (document.hidden) {
        msg.textContent = "화면으로 돌아오면 이어집니다";
        document.addEventListener("visibilitychange", function once() {
          if (!document.hidden) { document.removeEventListener("visibilitychange", once); wait(); }
        });
        return;
      }
      var delay = cfg.minDelay + Math.random() * (cfg.maxDelay - cfg.minDelay);
      timer = setTimeout(function () {
        pad.className = "rt-pad on";
        msg.textContent = "지금!";
        // 화면에 실제로 그려지는 프레임에서 시각을 잡는다.
        // setTimeout 시점과 실제 표시 사이에 한 프레임 이상 차이가 날 수 있다.
        var armedBy = null;
        function arm(how) {
          if (armed) return;
          shownAt = performance.now();
          armed = true;
          armedBy = how;
        }
        requestAnimationFrame(function () { requestAnimationFrame(function () { arm("raf"); }); });
        // RAF는 탭이 가려지거나 절전 상태면 멈춘다. 그러면 영원히 arm되지 않아
        // 모든 입력이 성급한 반응으로 처리되는 막다른 상태가 된다. 120ms 뒤에는 무조건 연다.
        setTimeout(function () { arm("timeout"); }, 120);
      }, delay);
    }

    function hit() {
      if (!armed) {
        // 자극 전에 누른 경우. 기록하지 않고 같은 시행을 다시 한다.
        clearTimeout(timer);
        early++;
        armed = false;
        pad.className = "rt-pad early";
        msg.textContent = "너무 빨랐습니다. 초록색이 된 뒤에 누르세요";
        setTimeout(wait, 1200);
        return;
      }
      var rt = Math.round(performance.now() - shownAt);
      armed = false;
      clearTimeout(timer);

      // 100ms 미만은 신호를 보고 반응한 것이 아니라 미리 누른 것이다.
      // 반응시간 연구에서 예측 반응(anticipation)으로 보고 버리는 관행을 따른다.
      if (rt < 100) {
        early++;
        pad.className = "rt-pad early";
        msg.textContent = "너무 빨랐습니다. 초록색을 보고 누르세요";
        setTimeout(wait, 1200);
        return;
      }

      if (!isPractice()) trials.push(rt);

      pad.className = "rt-pad done";
      msg.textContent = rt + " ms";
      idx++;

      if (idx >= total) {
        setTimeout(finish, 900);
      } else {
        setTimeout(wait, 900);
      }
    }

    function finish() {
      clear(stage);
      setHead("");
      var med = median(trials);
      var fast = Math.min.apply(null, trials);
      var slow = Math.max.apply(null, trials);
      showResult(
        [["중앙값", med + " ms"],
         ["가장 빠른 시행", fast + " ms"],
         ["가장 느린 시행", slow + " ms"],
         ["성급한 반응", early + "회"]],
        med, true,
        "평균이 아니라 <b>중앙값</b>을 씁니다. 한 번 딴생각을 하면 평균은 크게 흔들리지만 중앙값은 덜 흔들립니다."
      );
    }

    // 입력 — 터치·클릭·스페이스를 모두 받되 중복 발화를 막는다
    var lock = false;
    function onInput(e) {
      if (e) e.preventDefault();
      if (lock) return;
      lock = true;
      setTimeout(function () { lock = false; }, 80);
      hit();
    }
    pad.addEventListener("touchstart", onInput, { passive: false });
    pad.addEventListener("mousedown", onInput);
    document.addEventListener("keydown", function (e) {
      if (e.code === "Space" && stage.contains(pad)) onInput(e);
    });

    clear(stage);
    stage.appendChild(pad);
    wait();
  }

  // ════════════════════════════════════════════════════════
  //  기억 폭 과제 (정순 / 역순)
  // ════════════════════════════════════════════════════════
  function runSpan() {
    var cfg = T.task;
    var blocks = cfg.blocks.slice();   // ["forward","backward"]
    var bi = 0;                        // 지금 블록
    var results = {};                  // 블록별 최장 성공 길이
    var len = cfg.startLen;
    var fails = 0;
    var seq = [];

    function blockName(k) { return k === "forward" ? "정순" : "역순"; }

    function makeSeq(n) {
      // 매번 새로 만든다. 고정 문항표를 쓰지 않는 이유는
      // 표준화 검사의 문항 세트에 권리가 걸려 있기 때문이기도 하다.
      var s = [], prev = -1;
      for (var i = 0; i < n; i++) {
        var d;
        do { d = Math.floor(Math.random() * 10); } while (d === prev);
        s.push(d); prev = d;
      }
      return s;
    }

    function showSeq() {
      seq = makeSeq(len);
      setHead(blockName(blocks[bi]) + " · " + len + "자리");
      clear(stage);
      var box = el("div", "span-show");
      var digit = el("div", "span-digit", "");
      box.appendChild(digit);
      stage.appendChild(box);

      var i = 0;
      function step() {
        if (i >= seq.length) {
          setTimeout(ask, cfg.gapMs);
          return;
        }
        digit.textContent = seq[i];
        digit.className = "span-digit on";
        setTimeout(function () {
          digit.className = "span-digit";
          digit.textContent = "";
          i++;
          setTimeout(step, cfg.gapMs);
        }, cfg.showMs);
      }
      setTimeout(step, 600);
    }

    function ask() {
      clear(stage);
      var wrap = el("div", "span-ask");
      var q = el("p", "span-q",
        blocks[bi] === "forward" ? "본 순서대로 눌러 주세요" : "거꾸로 눌러 주세요");
      wrap.appendChild(q);

      var out = el("div", "span-out", "");
      wrap.appendChild(out);

      var entered = [];
      var padw = el("div", "span-pad");
      for (var n = 1; n <= 10; n++) {
        (function (d) {
          var b = el("button", "span-key", String(d));
          b.onclick = function () {
            if (entered.length >= seq.length) return;
            entered.push(d);
            out.textContent = entered.join(" ");
            if (entered.length === seq.length) setTimeout(function () { judge(entered); }, 250);
          };
          padw.appendChild(b);
        })(n % 10);
      }
      wrap.appendChild(padw);

      var back = el("button", "span-back", "하나 지우기");
      back.onclick = function () {
        entered.pop();
        out.textContent = entered.join(" ");
      };
      wrap.appendChild(back);
      stage.appendChild(wrap);
    }

    function judge(entered) {
      var want = blocks[bi] === "forward" ? seq : seq.slice().reverse();
      var ok = entered.length === want.length;
      for (var i = 0; ok && i < want.length; i++) if (entered[i] !== want[i]) ok = false;

      clear(stage);
      var fb = el("div", "span-fb " + (ok ? "ok" : "no"),
        ok ? "맞았습니다" : "정답은 " + want.join(" ") + " 였습니다");
      stage.appendChild(fb);

      if (ok) {
        results[blocks[bi]] = len;
        fails = 0;
        len++;
        if (len > cfg.maxLen) { setTimeout(nextBlock, 1100); return; }
        setTimeout(showSeq, 1100);
      } else {
        fails++;
        if (fails >= cfg.attemptsPerLen) { setTimeout(nextBlock, 1400); return; }
        setTimeout(showSeq, 1400);   // 같은 길이로 한 번 더
      }
    }

    function nextBlock() {
      bi++;
      len = cfg.startLen;
      fails = 0;
      if (bi >= blocks.length) { finish(); return; }
      clear(stage);
      var w = el("div", "span-ask");
      w.appendChild(el("p", "span-q", blockName(blocks[bi]) + " 차례입니다."));
      w.appendChild(el("p", "task-note",
        blocks[bi] === "backward" ? "이번에는 본 순서를 뒤집어서 눌러야 합니다." : ""));
      w.appendChild(bigButton("시작", showSeq));
      stage.appendChild(w);
    }

    function finish() {
      clear(stage);
      setHead("");
      var f = results.forward || 0;
      var b = results.backward || 0;
      var rows = [["정순 (본 순서대로)", f ? f + "자리" : "0자리"]];
      if (blocks.indexOf("backward") >= 0) rows.push(["역순 (거꾸로)", b ? b + "자리" : "0자리"]);
      showResult(rows, f + b, false,
        "정순은 들은 것을 <b>그대로 붙잡아 두는 힘</b>이고, 역순은 붙잡아 둔 것을 "
        + "<b>머릿속에서 뒤집는 힘</b>입니다. 역순이 정순보다 1~2자리 짧은 것이 보통입니다.");
    }

    clear(stage);
    var intro = el("div", "span-ask");
    intro.appendChild(el("p", "span-q", blockName(blocks[0]) + "부터 시작합니다."));
    intro.appendChild(bigButton("시작", showSeq));
    stage.appendChild(intro);
  }

  // ── 시작 ────────────────────────────────────────────────
  function start() {
    res.style.display = "none";
    clear(res);
    if (T.kind === "rt") runRT();
    else if (T.kind === "span") runSpan();
  }

  var go = $("taskstart");
  if (go) go.onclick = start;
})();
