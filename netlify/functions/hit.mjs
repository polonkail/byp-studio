import { json, handle, store, mutateJSON, salonNow } from '../lib/util.mjs';
import { createHash } from 'node:crypto';

// Névtelen látogatásszámláló: oldalmegtekintés + napi egyedi látogató (IP+böngésző napi sóval hashelve, süti nélkül).
const BOT = /bot|crawl|spider|slurp|preview|monitor|headless|lighthouse/i;
export default handle(async (req, ctx) => {
  if (req.method !== 'POST') return json({ ok: false }, 405);
  const ua = req.headers.get('user-agent') || '';
  if (!ua || BOT.test(ua)) return json({ ok: true });
  const { date } = salonNow();
  const salt = process.env.ADMIN_PASSWORD || 'byp';
  const h = createHash('sha256').update(`${date}|${ctx.ip || ''}|${ua}|${salt}`).digest('base64url').slice(0, 10);
  const day = date.slice(8, 10);
  await mutateJSON(store('stats'), `visits/${date.slice(0, 7)}`, doc => {
    doc = doc || {};
    const d = doc[day] || { pv: 0, u: [] };
    d.pv += 1;
    if (!d.u.includes(h) && d.u.length < 20000) d.u.push(h);
    doc[day] = d;
    return doc;
  });
  return json({ ok: true });
});
export const config = { path: '/api/hit' };
