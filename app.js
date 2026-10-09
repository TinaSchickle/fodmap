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
      `<span class="name">${esc(f.name)}</span>` +
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
      groupHtml('yes', 'Mjam 😋', yes, q) + groupHtml('no', 'Igitt 🙅', no, q);

    const nf = $('notFound');
    nf.hidden = !(q && !list.length);
    if (!nf.hidden) {
      nf.innerHTML = `Nicht gefunden<button type="button" id="addFromSearch">„${esc(raw.trim())}“ als To-do merken</button>`;
    }
    if (q && !list.length) $('accordions').innerHTML = '';

    $('todoCount').hidden = !todos.length;
    $('todoCount').textContent = todos.length;
    $('todoList').innerHTML = todos.map((t) =>
      `<li data-id="${t.id}"><span class="term">${esc(t.term)}</span><button type="button" data-done="${t.id}">Erledigt</button></li>`
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

  // Tabs
  function showTab(name) {
    const todo = name === 'todo';
    $('viewList').hidden = todo;
    $('viewTodo').hidden = !todo;
    $('tabList').classList.toggle('active', !todo);
    $('tabTodo').classList.toggle('active', todo);
    $('search').hidden = todo;
    render();
  }
  $('tabList').addEventListener('click', () => showTab('list'));
  $('tabTodo').addEventListener('click', () => showTab('todo'));

  $('search').addEventListener('input', render);
  $('showAdditional').addEventListener('change', render);

  load();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
})();
