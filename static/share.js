/* SNS 공유 띠 — .snsbar[data-url][data-title][data-text] 안의 button[data-sns] 를 처리한다.
   서버 없이 각 서비스의 공유 URL 만 연다. 카카오톡만 JS SDK 가 필요해서 키가 있을 때만 버튼이 나온다. */
(function () {
  var KAKAO_SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js";
  var kakaoReady = null;

  function toast(m) {
    var t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = m; t.className = "toast show";
    setTimeout(function () { t.className = "toast"; }, 1800);
  }

  function popup(u) {
    var w = window.open(u, "snsshare", "width=620,height=580,menubar=no,toolbar=no");
    if (!w) location.href = u;
  }

  function loadKakao(key) {
    if (kakaoReady) return kakaoReady;
    kakaoReady = new Promise(function (ok, no) {
      var s = document.createElement("script");
      s.src = KAKAO_SDK; s.crossOrigin = "anonymous";
      s.onload = function () {
        try { if (!window.Kakao.isInitialized()) window.Kakao.init(key); ok(window.Kakao); }
        catch (e) { no(e); }
      };
      s.onerror = no;
      document.head.appendChild(s);
    });
    return kakaoReady;
  }

  function share(kind, bar) {
    var url = bar.getAttribute("data-url") || location.href.split("#")[0];
    var title = bar.getAttribute("data-title") || document.title;
    var text = bar.getAttribute("data-text") || title;
    var U = encodeURIComponent(url), T = encodeURIComponent(text);
    switch (kind) {
      case "kakao":
        loadKakao(bar.getAttribute("data-kakao")).then(function (K) {
          // sendScrap(카카오 서버가 og 태그를 긁어오는 방식)은 "요청 실패"가 잦아서,
          // 카드 내용을 직접 넘긴다. 그림은 빌드 때 만든 og:image.
          var og = document.querySelector('meta[property="og:image"]');
          var desc = document.querySelector('meta[property="og:description"]');
          K.Share.sendDefault({
            objectType: "feed",
            content: {
              title: title,
              description: (desc && desc.content) || text,
              imageUrl: og ? og.content : "",
              imageWidth: 1200, imageHeight: 630,
              link: { mobileWebUrl: url, webUrl: url }
            },
            buttons: [{ title: "해보기", link: { mobileWebUrl: url, webUrl: url } }]
          });
        }).catch(function () { toast("카카오톡 창이 막혔어요. 팝업을 허용하거나 링크를 복사해 보내 주세요"); });
        break;
      case "naver": popup("https://share.naver.com/web/shareView?url=" + U + "&title=" + encodeURIComponent(title)); break;
      case "band": popup("https://band.us/plugin/share?body=" + encodeURIComponent(text + "\n" + url) + "&route=" + U); break;
      case "facebook": popup("https://www.facebook.com/sharer/sharer.php?u=" + U); break;
      case "x": popup("https://twitter.com/intent/tweet?url=" + U + "&text=" + T); break;
      case "line": popup("https://social-plugins.line.me/lineit/share?url=" + U + "&text=" + T); break;
      case "threads": popup("https://www.threads.net/intent/post?text=" + encodeURIComponent(text + "\n" + url)); break;
      case "telegram": popup("https://t.me/share/url?url=" + U + "&text=" + T); break;
      case "copy":
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast("링크를 복사했어요"); });
        else prompt("아래 링크를 복사하세요", url);
        break;
      case "more":
        if (navigator.share) navigator.share({ title: title, text: text, url: url }).catch(function () {});
        break;
    }
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".snsbar button[data-sns]");
    if (!b) return;
    e.preventDefault();
    share(b.getAttribute("data-sns"), b.closest(".snsbar"));
  });

  // 기기 공유 시트(카톡·문자·메일 등)는 지원하는 브라우저에서만 보여 준다.
  // 윈도우 데스크탑 크롬도 navigator.share가 있지만 거기서 뜨는 창엔 카톡이 없어서, 터치 기기로 한정한다.
  var touch = window.matchMedia && window.matchMedia("(pointer:coarse)").matches;
  if (navigator.share && touch) {
    var more = document.querySelectorAll('.snsbar button[data-sns="more"]');
    for (var i = 0; i < more.length; i++) more[i].style.display = "";
  }
})();
