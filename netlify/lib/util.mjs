import { getStore } from '@netlify/blobs';
import { timingSafeEqual, createHash } from 'node:crypto';
import { SALON, SPECIALISTS } from './config.mjs';

export class HttpError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

export const handle = fn => async (req, ctx) => {
  try { return await fn(req, ctx); }
  catch (e) {
    if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
    console.error(e);
    return json({ error: 'server_error', message: 'Váratlan hiba történt.' }, 500);
  }
};

export const store = name => getStore({ name, consistency: 'strong' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Read-modify-write a JSON blob with optimistic concurrency (etag). fn returns the new value or throws. */
export async function mutateJSON(st, key, fn, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const cur = await st.getWithMetadata(key, { type: 'json' });
    const next = await fn(cur ? structuredClone(cur.data) : null);
    const res = await st.setJSON(key, next, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (!res || res.modified !== false) return next;
    await sleep(60 + Math.random() * 180);
  }
  throw new HttpError(409, 'busy', 'Épp nagy a forgalom, próbáld újra pár másodperc múlva.');
}

// ---- time helpers (salon local time) ----
export const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const toT = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
export const weekday = date => new Date(date + 'T12:00:00Z').getUTCDay();
export const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function salonNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: SALON.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}$/;

export const spec = id => SPECIALISTS.find(s => s.id === id);
export const monthKey = (specId, date) => `${specId}/${date.slice(0, 7)}`;
// Ütközésvizsgálat. me = { fill, soft }: a „fill” foglalás (pl. férfi hajvágás) beférhet egy másik foglalás
// „soft” szakaszába (pl. a hajfesték hatóideje alatt); minden más átfedés ütközés.
const inside = (soft, lo, hi) => (soft || []).some(([s, e]) => s <= lo && hi <= e);
export const overlaps = (items, start, dur, me = {}) => items.some(it => {
  const a = toMin(it.start), a1 = a + it.dur, e = start + dur;
  if (!(start < a1 && a < e)) return false;
  const lo = Math.max(start, a), hi = Math.min(e, a1);
  if (me.fill && !it.fill) return !inside(it.soft, lo, hi);
  if (it.fill && !me.fill) return !inside(me.soft, lo, hi);
  return true;
});

// ---- admin auth ----
const h = s => createHash('sha256').update(String(s)).digest();
export function requireAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new HttpError(500, 'no_password', 'Az ADMIN_PASSWORD környezeti változó nincs beállítva a Netlify-on.');
  const given = req.headers.get('x-admin-password') || '';
  if (!timingSafeEqual(h(given), h(expected))) throw new HttpError(401, 'unauthorized', 'Hibás jelszó.');
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

// ---- heti munkarend (szabadnapok) a kezelőfelületről; felülírja a config.mjs alapértelmezését ----
const DEFAULT_HOURS = Object.fromEntries(SPECIALISTS.map(s => [s.id, JSON.parse(JSON.stringify(s.hours))]));
export async function loadSchedule() {
  let saved = null;
  try { saved = await store('settings').get('schedule', { type: 'json' }); } catch {}
  for (const s of SPECIALISTS) s.hours = (saved && saved[s.id]) || JSON.parse(JSON.stringify(DEFAULT_HOURS[s.id]));
  return saved || {};
}
export const defaultHours = id => DEFAULT_HOURS[id];
