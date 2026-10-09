(function () {
  const KEY = 'fodmap-v1';
  const base = window.WORDS || { yes: [], no: [] };

  // Gespeichert wird nur, was in der App passiert: hinzugefügte und durchgestrichene Wörter.
  let user = { added: { yes: [], no: [] }, crossed: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw) user = { added: { yes: [], no: [], ...raw.added }, crossed: raw.crossed || [] };
  } catch (e) { /* kein Speicher verfügbar – läuft trotzdem */ }

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(user)); } catch (e) {} };
  const norm = (s) => s.trim().toLowerCase();
  const $ = (id) => document.getElementById(id);

  function words(kind) {
    const seen = new Set();
    return [...base[kind], ...user.added[kind]]
      .map((w) => w.trim())
      .filter((w) => w && !seen.has(norm(w)) && seen.add(norm(w)))
      .sort((a, b) => a.localeCompare(b, 'de'));
  }
  const isCrossed = (w) => user.crossed.includes(norm(w));
  const kindOf = (w) => {
    const n = norm(w);
    if (words('no').some((x) => norm(x) === n)) return 'no';
    if (words('yes').some((x) => norm(x) === n)) return 'yes';
    return null;
  };

  function esc(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function renderLists() {
    const q = norm($('search').value);
    for (const [kind, id] of [['no', 'listNo'], ['yes', 'listYes']]) {
      $(id).innerHTML = words(kind).map((w) =>
        `<li data-w="${esc(w)}" class="${isCrossed(w) ? 'crossed' : ''}${q && norm(w).includes(q) ? ' hit' : ''}">${esc(w)}</li>`
      ).join('');
    }
  }

  function renderResult() {
    const el = $('result');
    const q = norm($('search').value);
    if (!q) { el.hidden = true; return; }
    el.hidden = false;
    const all = [...words('no').map((w) => [w, 'no']), ...words('yes').map((w) => [w, 'yes'])]
      .filter(([w]) => norm(w).includes(q));
    const exact = all.find(([w]) => norm(w) === q);
    const label = { yes: 'Mjam', no: 'Igitt' };
    const cls = (w) => (isCrossed(w) ? ' crossed' : '');

    if (!all.length) {
      el.className = 'result is-none';
      el.innerHTML = `Nicht gefunden<button class="link" id="addFromSearch" type="button">„${esc($('search').value.trim())}“ hinzufügen</button>`;
    } else if (exact || all.length === 1) {
      const [w, k] = exact || all[0];
      el.className = `result is-${k}`;
      el.innerHTML = `<span class="${cls(w).trim()}">${esc(w)}</span> – ${label[k]}`;
    } else {
      el.className = 'result is-mixed';
      el.innerHTML = all.slice(0, 20).map(([w, k]) =>
        `<div class="row ${k}"><span class="${cls(w).trim()}">${esc(w)}</span><small>${label[k]}</small></div>`
      ).join('');
    }
  }

  const render = () => { renderLists(); renderResult(); };

  $('search').addEventListener('input', render);
  document.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-w]');
    if (li) {
      const n = norm(li.dataset.w);
      user.crossed = isCrossed(n) ? user.crossed.filter((x) => x !== n) : [...user.crossed, n];
      save(); render();
    }
    if (e.target.id === 'addFromSearch') openAdd($('search').value.trim());
  });

  // Hinzufügen-Dialog
  const dlg = $('addDialog');
  function openAdd(prefill) {
    $('addWord').value = prefill || '';
    $('addMsg').hidden = true;
    dlg.showModal();
    $('addWord').focus();
  }
  $('openAdd').addEventListener('click', () => openAdd(''));
  $('cancelAdd').addEventListener('click', () => dlg.close());
  $('addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const word = $('addWord').value.trim();
    if (!word) return;
    const existing = kindOf(word);
    if (existing) {
      $('addMsg').textContent = `„${word}“ gibt es schon (${existing === 'yes' ? 'Mjam' : 'Igitt'}).`;
      $('addMsg').hidden = false;
      return;
    }
    const kind = new FormData($('addForm')).get('kind');
    user.added[kind].push(word);
    save();
    dlg.close();
    $('search').value = word;
    render();
  });

  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
})();
