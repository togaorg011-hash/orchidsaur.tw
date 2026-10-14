/* 蘭獸網站：04「與獸同行」民眾投稿（Supabase）
   - 讀取：只抓「已核准」的投稿，顯示在 04 頁面
   - 送出：照片先縮小再上傳，文字存成「待審核」，由管理員在 Supabase 後台核准後才公開
   這裡的金鑰是 Publishable key（設計上就是公開給網站用的），不是祕密金鑰。 */
(function () {
  var URL_BASE = 'https://fcdovmbqawnwgbrwvyhe.supabase.co';
  var KEY = 'sb_publishable_QxJVNBjZXRV9mRH12vqnGw_2k48rOjy';
  var BUCKET = 'submission-photos';
  var MAX_SIDE = 1400, MAX_BYTES = 1900000;

  function headers(extra) {
    var h = { apikey: KEY, Authorization: 'Bearer ' + KEY };
    for (var k in extra) h[k] = extra[k];
    return h;
  }

  function photoUrl(path) { return URL_BASE + '/storage/v1/object/public/' + BUCKET + '/' + encodeURIComponent(path); }

  /* 取得已核准的投稿（舊 → 新） */
  function fetchApproved() {
    var q = '/rest/v1/submissions?select=id,created_at,nickname,location,story,photo_path&status=eq.approved&order=created_at.asc&limit=500';
    return fetch(URL_BASE + q, { headers: headers() })
      .then(function (r) { if (!r.ok) throw new Error('read ' + r.status); return r.json(); })
      .then(function (rows) { return rows.map(function (r) { r.photo_url = photoUrl(r.photo_path); return r; }); });
  }

  /* 把照片縮到最長邊 1400px 的 JPEG，檔案過大就降低品質 */
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), obj = window.URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, MAX_SIDE / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        window.URL.revokeObjectURL(obj);
        var q = 0.85;
        (function attempt() {
          c.toBlob(function (b) {
            if (!b) return reject(new Error('photo'));
            if (b.size > MAX_BYTES && q > 0.4) { q -= 0.15; return attempt(); }
            if (b.size > MAX_BYTES) return reject(new Error('photo-size'));
            resolve(b);
          }, 'image/jpeg', q);
        })();
      };
      img.onerror = function () { window.URL.revokeObjectURL(obj); reject(new Error('photo')); };
      img.src = obj;
    });
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /* 送出：先傳照片，再寫入文字（一律待審核） */
  function submit(data) {
    var path = uuid() + '.jpg';
    return shrink(data.file).then(function (blob) {
      return fetch(URL_BASE + '/storage/v1/object/' + BUCKET + '/' + path, {
        method: 'POST', headers: headers({ 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }), body: blob
      });
    }).then(function (r) {
      if (!r.ok) throw new Error('upload ' + r.status);
      return fetch(URL_BASE + '/rest/v1/submissions', {
        method: 'POST', headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ nickname: data.nickname, location: data.location, story: data.story, photo_path: path, consent: true, status: 'pending' })
      });
    }).then(function (r) { if (!r.ok) throw new Error('save ' + r.status); });
  }

  window.orchidSB = { fetchApproved: fetchApproved, submit: submit };
})();
