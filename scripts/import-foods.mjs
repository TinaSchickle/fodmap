// Einmaliger Import: node scripts/import-foods.mjs
// Liest data/fodmap_foods.json und schreibt per Upsert (Konflikt auf name) nach Supabase.
// Bereits gesetztes "crossed" wird dabei nicht überschrieben.
import { readFileSync } from 'node:fs';

const cfg = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const url = /SUPABASE_URL = '([^']+)'/.exec(cfg)[1];
const key = /SUPABASE_KEY = '([^']+)'/.exec(cfg)[1];
const { foods } = JSON.parse(readFileSync(new URL('../data/fodmap_foods.json', import.meta.url), 'utf8'));
const rows = foods.map(({ crossed, ...f }) => f); // crossed bewusst weglassen

const res = await fetch(`${url}/rest/v1/fodmap_foods?on_conflict=name`, {
  method: 'POST',
  headers: {
    apikey: key,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify(rows),
});
console.log(res.status, res.ok ? `${rows.length} Einträge importiert` : await res.text());
