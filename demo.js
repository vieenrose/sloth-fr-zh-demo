(() => {
  const search = document.getElementById('search');
  const status = document.getElementById('status');
  const syncInfo = document.getElementById('syncInfo');
  const results = document.getElementById('results');
  const entry = document.getElementById('entry');
  const entryTitle = document.getElementById('entryTitle');

  let data = { entries: {}, variants: {}, meta: {} };
  let keys = [];
  let active = -1;
  let shown = [];

  const esc = s => s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function setStatus(text) { status.textContent = text; }

  async function loadSyncInfo() {
    if (!syncInfo) return;
    try {
      const res = await fetch('demo-version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const v = await res.json();
      const short = v.short || (v.sha || '').slice(0, 7) || 'inconnu';
      const link = v.sha && v.repo
        ? `<a href="https://github.com/${esc(v.repo)}/commit/${esc(v.sha)}" target="_blank" rel="noopener" title="${esc(v.sha)}">${esc(short)}</a>`
        : esc(short);
      const when = v.synced_at ? ` · ${esc(v.synced_at)}` : '';
      syncInfo.innerHTML = `同步版本：${link} (${esc(v.branch || 'open')})${when}`;
    } catch (e) {
      syncInfo.textContent = '同步版本：未知（本機預覽）';
    }
  }

  async function load() {
    try {
      setStatus('下載詞典資料…');
      const res = await fetch('demo-data.json.gz?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let buf = await res.arrayBuffer();
      if (typeof DecompressionStream !== 'undefined') {
        const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
        buf = await new Response(stream).arrayBuffer();
      }
      const text = new TextDecoder('utf-8').decode(buf);
      data = JSON.parse(text);
      keys = Object.keys(data.entries).concat(Object.keys(data.variants)).sort();
      setStatus(`${data.meta.entries.toLocaleString()} 詞條・${data.meta.variants.toLocaleString()} 變形`);
      const hash = decodeURIComponent(location.hash.slice(1));
      if (hash && data.entries[hash]) show(hash);
      else show('manger');
    } catch (e) {
      setStatus('載入失敗：' + e.message);
      entry.innerHTML = '<p class="hint">無法載入 demo-data.json.gz。請確認透過 HTTP 伺服器開啟本頁，而不是 file://。</p>';
    }
  }

  function resolve(q) {
    const word = q.trim().toLowerCase();
    if (data.entries[word]) return [word, ''];
    if (data.variants[word]) return [data.variants[word], word];
    return [null, ''];
  }

  function show(word, variant = '') {
    if (!word || !data.entries[word]) return;
    entry.innerHTML = data.entries[word];
    entryTitle.textContent = variant ? `${variant} → ${word}` : word;
    location.hash = encodeURIComponent(variant || word);
    document.title = `${variant || word} — Sloth 法漢詞典`;
  }

  function searchWords(q) {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const out = [];
    for (const k of keys) {
      if (k.startsWith(query)) out.push(k);
      if (out.length >= 80) break;
    }
    if (out.length < 20) {
      for (const k of keys) {
        if (!out.includes(k) && k.includes(query)) out.push(k);
        if (out.length >= 40) break;
      }
    }
    return out;
  }

  function renderResults() {
    results.innerHTML = '';
    shown = searchWords(search.value);
    active = shown.length ? 0 : -1;
    for (const [i, word] of shown.entries()) {
      const li = document.createElement('li');
      const canonical = data.variants[word] || word;
      li.innerHTML = `<span>${esc(word)}</span>${canonical !== word ? `<small>→ ${esc(canonical)}</small>` : ''}`;
      if (i === active) li.className = 'active';
      li.addEventListener('click', () => {
        const [head, variant] = resolve(word);
        show(head, variant);
      });
      results.appendChild(li);
    }
  }

  search.addEventListener('input', renderResults);
  search.addEventListener('keydown', e => {
    if (!shown.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, shown.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const [head, variant] = resolve(shown[active]);
      show(head, variant);
      return;
    }
    [...results.children].forEach((li, i) => li.className = i === active ? 'active' : '');
  });

  loadSyncInfo();
  load();
})();
