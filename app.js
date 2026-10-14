(function () {
  const BASE = `${window.SUPABASE_URL}/rest/v1`;
  const HEADERS = { apikey: window.SUPABASE_KEY, 'Content-Type': 'application/json' };
  const CACHE_KEY = 'fodmap-cache-v2';

  const $ = (id) => document.getElementById(id);
  const norm = (s) => s.trim().toLowerCase();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const CAT_ORDER = ['Obst', 'Gemüse', 'Nüsse und Samen', 'Hülsenfrüchte', 'Getreide und Backwaren', 'Milchprodukte und Alternativen', 'Fleisch, Fisch und Ei', 'Fette und Öle', 'Getränke', 'Süßes und Süßungsmittel', 'Gewürze und Kräuter', 'Saucen und Würzmittel', 'Snacks und Fertigprodukte'];
  const catRank = (c) => { const i = CAT_ORDER.indexOf(c); return i < 0 ? 99 : i; };
  let foods = [];
  let todos = [];
  const DISH_KEY = 'fodmap-dish-v1';
  const DEFAULT_G = 500;
  let dish = {}; // Lebensmittel-ID -> Gramm
  try { dish = JSON.parse(localStorage.getItem(DISH_KEY)) || {}; } catch (e) {}
  const saveDish = () => { try { localStorage.setItem(DISH_KEY, JSON.stringify(dish)); } catch (e) {} };
  const openSet = new Set(['yes']); // aufgeklappte Gruppen (Schlüssel: 'yes', 'no', 'yes|Obst' …)

  async function api(path, opts = {}) {
    const res = await fetch(BASE + path, { ...opts, headers: { ...HEADERS, ...(opts.headers || {}) } });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  function setStatus(msg) {
    $('status').hidden = !msg;
    $('status').textContent = msg || '';
  }

  async function load() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (cached) { foods = cached.foods; todos = cached.todos; render(); }
    } catch (e) {}
    try {
      [foods, todos] = await Promise.all([
        api('/fodmap_foods?select=*&order=name&limit=2000'),
        api('/fodmap_todos?select=*&order=created_at'),
      ]);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ foods, todos })); } catch (e) {}
      setStatus('');
    } catch (e) {
      setStatus(foods.length ? 'Offline – zeige zuletzt geladene Liste.' : 'Konnte die Liste nicht laden.');
    }
    render();
  }

  const cacheNow = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ foods, todos })); } catch (e) {} };

  function portionText(f) {
    if (f.rating === 'red') return 'meiden';
    if (f.unlimited) return 'ohne Grenze';
    const p = `${Number(f.safe_portion)} ${f.unit}`;
    return f.rating === 'amber' ? `max. ${p}` : `bis ${p}`;
  }

  function foodRow(f) {
    return `<li class="food ${f.rating}${f.crossed ? ' crossed' : ''}" data-id="${f.id}">` +
      `<button type="button" class="pick${dish[f.id] != null ? ' on' : ''}" data-pick="${f.id}" aria-label="Zum Gericht hinzufügen" aria-pressed="${dish[f.id] != null}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></button><span class="name">${esc(f.name)}</span>` +
      (f.verify ? '<span class="q" title="Wert unsicher">?</span>' : '') +
      `<span class="portion">${portionText(f)}</span></li>`;
  }

  function groupHtml(key, title, items, q) {
    const cats = new Map();
    for (const f of items) {
      if (!cats.has(f.category)) cats.set(f.category, []);
      cats.get(f.category).push(f);
    }
    const inner = [...cats.entries()].sort((a, b) => catRank(a[0]) - catRank(b[0])).map(([cat, list]) => {
      const k = `${key}|${cat}`;
      return `<details class="cat" data-key="${esc(k)}"${q || openSet.has(k) ? ' open' : ''}>` +
        `<summary>${esc(cat)}<span class="count">${list.length}</span></summary>` +
        `<ul class="foods">${list.map(foodRow).join('')}</ul></details>`;
    }).join('');
    return `<details class="group ${key}" data-key="${key}"${q || openSet.has(key) ? ' open' : ''}>` +
      `<summary>${title}<span class="count">${items.length}</span></summary>` +
      `<div class="inner">${inner || '<p class="hint">Nichts gefunden.</p>'}</div></details>`;
  }

  function render() {
    const raw = $('search').value;
    const q = norm(raw);
    const extra = $('showAdditional').checked;
    const list = foods.filter((f) => (extra || f.tier === 'basic' || q) && (!q || norm(f.name).includes(q)));
    const yes = list.filter((f) => f.rating !== 'red');
    const no = list.filter((f) => f.rating === 'red');

    $('accordions').innerHTML =
      groupHtml('yes', '<span class="gi"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>Siii', yes, q) + groupHtml('no', '<span class="gi"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></span>Nope', no, q);

    const nf = $('notFound');
    nf.hidden = !(q && !list.length);
    if (!nf.hidden) {
      nf.innerHTML = `Nicht gefunden<button type="button" id="addFromSearch">„${esc(raw.trim())}“ als To-do merken</button>`;
    }
    if (q && !list.length) $('accordions').innerHTML = '';

    const dn = Object.keys(dish).length;
    $('dishCount').hidden = !dn;
    $('dishCount').textContent = dn;
    $('todoCount').hidden = !todos.length;
    $('todoCount').textContent = todos.length;
    $('todoList').innerHTML = todos.map((t) =>
      `<li data-id="${t.id}"><span class="term">${esc(t.term)}</span><button type="button" data-done="${t.id}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>Erledigt</button></li>`
    ).join('');
    $('todoEmpty').hidden = todos.length > 0;
  }

  // Akkordeon-Zustand merken
  $('accordions').addEventListener('toggle', (e) => {
    const d = e.target;
    if (!d.dataset || !d.dataset.key || $('search').value.trim()) return;
    d.open ? openSet.add(d.dataset.key) : openSet.delete(d.dataset.key);
  }, true);

  // Durchstreichen
  $('accordions').addEventListener('click', async (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      const id = Number(pick.dataset.pick);
      if (dish[id] != null) delete dish[id]; else dish[id] = DEFAULT_G;
      saveDish(); render();
      return;
    }
    const li = e.target.closest('li.food');
    if (!li) return;
    const f = foods.find((x) => x.id === Number(li.dataset.id));
    if (!f) return;
    f.crossed = !f.crossed;
    render(); cacheNow();
    try {
      await api(`/fodmap_foods?id=eq.${f.id}`, { method: 'PATCH', body: JSON.stringify({ crossed: f.crossed }) });
    } catch (err) {
      f.crossed = !f.crossed;
      render(); cacheNow();
      setStatus('Speichern fehlgeschlagen – bist du online?');
    }
  });

  // To-dos
  async function addTodo(term) {
    term = term.trim();
    if (!term) return false;
    if (todos.some((t) => norm(t.term) === norm(term))) return true;
    try {
      const [row] = await api('/fodmap_todos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ term }) });
      todos.push(row); cacheNow(); render();
      return true;
    } catch (e) {
      setStatus('Speichern fehlgeschlagen – bist du online?');
      return false;
    }
  }
  $('todoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await addTodo($('todoTerm').value)) $('todoTerm').value = '';
  });
  $('todoList').addEventListener('click', async (e) => {
    const id = Number(e.target.dataset.done);
    if (!id) return;
    const before = todos;
    todos = todos.filter((t) => t.id !== id);
    render(); cacheNow();
    try { await api(`/fodmap_todos?id=eq.${id}`, { method: 'DELETE' }); }
    catch (err) { todos = before; render(); cacheNow(); setStatus('Löschen fehlgeschlagen – bist du online?'); }
  });
  $('notFound').addEventListener('click', async (e) => {
    if (e.target.id !== 'addFromSearch') return;
    if (await addTodo($('search').value)) { $('search').value = ''; showTab('todo'); }
  });

  // Gericht
  const RMV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const dishItems = () => Object.keys(dish).map((id) => foods.find((f) => f.id === Number(id))).filter(Boolean);
  const loadOf = (f, g) => (f.rating === 'red' || f.unlimited || !(Number(f.safe_portion) > 0) ? null : (g / Number(f.safe_portion)) * 100);
  const fmt = (n) => Math.round(n).toLocaleString('de-DE');

  function renderDish() {
    const items = dishItems();
    $('dishEmpty').hidden = items.length > 0;
    $('dishClear').hidden = !items.length;
    $('dishFine').hidden = !items.length;
    $('dishList').innerHTML = items.map((f) =>
      `<li class="dish-item ${f.rating}" data-id="${f.id}">` +
      `<div class="di-top"><span class="dot"></span><span class="name">${esc(f.name)}</span>` +
      (f.verify ? '<span class="q" title="Wert unsicher">?</span>' : '') +
      `<button type="button" class="di-remove" data-remove="${f.id}" aria-label="Entfernen">${RMV}</button></div>` +
      `<div class="di-mid"><label class="gram"><input type="number" inputmode="decimal" min="0" step="10" value="${dish[f.id]}" data-gram="${f.id}" aria-label="Gramm"><span>${f.unit || 'g'}</span></label>` +
      `<span class="di-load" data-load="${f.id}"></span></div>` +
      `<div class="bar"><i data-bar="${f.id}"></i></div><p class="di-note" data-note="${f.id}"></p></li>`
    ).join('');
    updateDish();
  }

  function updateDish() {
    const items = dishItems();
    const count = Object.keys(dish).length;
    $('dishCount').hidden = !count;
    $('dishCount').textContent = count;
    let total = 0, sum = 0, limited = 0;
    const reds = [], overs = [];
    for (const f of items) {
      const g = Number(dish[f.id]) || 0;
      total += g;
      const load = loadOf(f, g);
      const loadEl = document.querySelector('[data-load="' + f.id + '"]');
      const barEl = document.querySelector('[data-bar="' + f.id + '"]');
      const noteEl = document.querySelector('[data-note="' + f.id + '"]');
      if (!loadEl) continue;
      if (f.rating === 'red') {
        reds.push(f.name);
        loadEl.textContent = 'meiden'; loadEl.className = 'di-load red';
        barEl.style.width = '0'; noteEl.textContent = 'Steht unter „Nope“ – keine sichere Portion.';
      } else if (load == null) {
        loadEl.textContent = 'ohne Grenze'; loadEl.className = 'di-load green';
        barEl.style.width = '0'; noteEl.textContent = 'Keine Grenze bekannt.';
      } else {
        limited++; sum += load;
        if (load > 100) overs.push(f.name + ' (' + fmt(load) + ' %)');
        const cls = load <= 100 ? 'green' : load <= 200 ? 'amber' : 'red';
        loadEl.textContent = fmt(load) + ' %'; loadEl.className = 'di-load ' + cls;
        barEl.style.width = Math.min(load, 100) + '%'; barEl.className = cls;
        noteEl.textContent = 'Sichere Portion: ' + Number(f.safe_portion) + ' ' + f.unit + ' pro Mahlzeit';
      }
    }
    const box = $('dishSummary');
    box.hidden = !items.length;
    if (!items.length) return;
    let kind = 'ok', head = 'Sieht gut aus', lines = [];
    if (reds.length) { kind = 'no'; head = 'Enthält „Nope“-Zutaten'; lines.push(reds.join(', ')); }
    if (overs.length) { if (kind === 'ok') { kind = 'warn'; head = 'Zu viel von einzelnen Zutaten'; } lines.push('Über der sicheren Portion: ' + overs.join(', ')); }
    if (kind === 'ok' && limited > 1 && sum > 100) { kind = 'warn'; head = 'Zusammen über dem Richtwert'; lines.push('Einzeln okay, in Summe aber mehr als 100 %. Eher kleinere Portion nehmen.'); }
    if (kind === 'ok' && !limited) lines.push('Alles ohne Mengengrenze.');
    box.className = 'dish-summary ' + kind;
    box.innerHTML = '<div class="ds-head">' + esc(head) + '</div>' +
      (lines.length ? '<p>' + lines.map(esc).join('<br>') + '</p>' : '') +
      '<div class="ds-stats"><div><span>Gesamtgewicht</span><strong>' + fmt(total) + ' g</strong></div>' +
      '<div><span>Summe der Anteile</span><strong>' + (limited ? fmt(sum) + ' %' : '–') + '</strong></div></div>';
  }

  $('dishList').addEventListener('input', (e) => {
    const id = e.target.dataset && e.target.dataset.gram;
    if (!id) return;
    const v = parseFloat(String(e.target.value).replace(',', '.'));
    dish[id] = Number.isFinite(v) && v >= 0 ? v : 0;
    saveDish(); updateDish();
  });
  $('dishList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    delete dish[btn.dataset.remove];
    saveDish(); render(); renderDish();
  });
  $('dishClear').addEventListener('click', () => {
    dish = {}; saveDish(); render(); renderDish();
  });

  // Tabs
  function showTab(name) {
    $('viewList').hidden = name !== 'list';
    $('viewDish').hidden = name !== 'dish';
    $('viewTodo').hidden = name !== 'todo';
    $('tabList').classList.toggle('active', name === 'list');
    $('tabDish').classList.toggle('active', name === 'dish');
    $('tabTodo').classList.toggle('active', name === 'todo');
    document.querySelector('.search-wrap').hidden = name !== 'list';
    document.querySelector('.tabs').dataset.active = name;
    render();
    if (name === 'dish') renderDish();
  }
  $('tabList').addEventListener('click', () => showTab('list'));
  $('tabDish').addEventListener('click', () => showTab('dish'));
  $('tabTodo').addEventListener('click', () => showTab('todo'));

  $('search').addEventListener('input', render);
  $('showAdditional').addEventListener('change', render);

  $('openLegend').addEventListener('click', () => $('legendDialog').showModal());
  $('closeLegend').addEventListener('click', () => $('legendDialog').close());
  $('legendDialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  load();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
})();
