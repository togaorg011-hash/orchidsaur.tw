/* 蘭獸網站：內容載入器
   把 content/ 資料夾裡的 JSON 內容檔讀進來，顯示在 01 起源、02 巡迴展歷、03 科學教室。
   一般更新內容只需要改 content/*.json（或用後台），不需要改這支檔案。 */
(function () {
  var FILES = { origin: 'content/origin.json', journey: 'content/journey.json', science: 'content/science.json' };
  var LANGS = ['zh', 'en', 'ja'];

  /* 取得指定語言的文字；該語言沒填的話，先用中文頂替 */
  function pick(obj, lang) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    return (obj[lang] && String(obj[lang]).trim()) ? obj[lang] : (obj.zh || '');
  }

  /* 內文小寫法（Markdown）轉成網頁：### 小標、- 清單、1. 編號清單、> 引言、**粗體**、*斜體*、[文字](網址) */
  function inline(t) {
    return t
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.+?)\*/g, '<i>$1</i>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function md(src) {
    if (!src) return '';
    var blocks = String(src).replace(/\r\n?/g, '\n').split(/\n{2,}/), out = [];
    blocks.forEach(function (b) {
      b = b.trim(); if (!b) return;
      var lines = b.split('\n');
      if (/^###\s+/.test(b)) {
        out.push('<h3>' + inline(b.replace(/^###\s+/, '')) + '</h3>');
      } else if (lines.every(function (l) { return /^>\s?/.test(l); })) {
        out.push('<blockquote>' + inline(lines.map(function (l) { return l.replace(/^>\s?/, ''); }).join('<br>')) + '</blockquote>');
      } else if (lines.every(function (l) { return /^-\s+/.test(l); })) {
        out.push('<ul>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^-\s+/, '')) + '</li>'; }).join('') + '</ul>');
      } else if (lines.every(function (l) { return /^\d+\.\s+/.test(l); })) {
        out.push('<ol>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^\d+\.\s+/, '')) + '</li>'; }).join('') + '</ol>');
      } else {
        out.push('<p>' + inline(lines.join('<br>')) + '</p>');
      }
    });
    return out.join('\n');
  }
  window.orchidMd = md;

  function buildItems(list, lang) {
    return list.map(function (it) {
      var photos = (it.photos || []).map(function (p) {
        return { src: p.src, cap: pick(p.caption, lang), focus: p.focus || '' };
      });
      return [pick(it.title, lang), pick(it.summary, lang), md(pick(it.body, lang)), it.date || '', photos, it.lat == null ? null : it.lat, it.lng == null ? null : it.lng];
    });
  }

  function load() {
    var keys = Object.keys(FILES);
    return Promise.all(keys.map(function (k) {
      return fetch(FILES[k], { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error(FILES[k] + ' ' + r.status);
        return r.json();
      });
    })).then(function (res) {
      keys.forEach(function (k, n) {
        window.orchidData = window.orchidData || {};
        window.orchidData[k] = res[n];
        LANGS.forEach(function (lang) { sectionsData[lang][k].items = buildItems(res[n], lang); });
      });
      renderUI();
      if (location.hash && document.getElementById(location.hash.slice(1))) go(location.hash.slice(1), false);
    }).catch(function (e) {
      console.error('內容載入失敗', e);
      var m = document.createElement('div');
      m.style.cssText = 'position:fixed;left:0;right:0;bottom:0;background:#7a2b2b;color:#fff;padding:10px 16px;font-size:14px;z-index:9998;text-align:center';
      m.textContent = '內容載入失敗，請重新整理頁面。（' + e.message + '）';
      document.body.appendChild(m);
    });
  }
  load();
})();
