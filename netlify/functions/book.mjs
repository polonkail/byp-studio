import { json, handle, spec, salonNow, addDays, weekday, toMin, clean, HttpError, DATE_RE, TIME_RE, loadSchedule } from '../lib/util.mjs';
import { SALON } from '../lib/config.mjs';
import { resolveItems, createBooking } from '../lib/booking.mjs';
import { gcalBusy } from '../lib/gcal.mjs';
import { overlaps } from '../lib/util.mjs';

// Online foglalás: egy vagy több szolgáltatás egymás után, egy szakembernél.
export default handle(async req => {
  if (req.method !== 'POST') throw new HttpError(405, 'method', 'Csak POST.');
  let b; try { b = await req.json(); } catch { throw new HttpError(400, 'bad_json', 'Hibás kérés.'); }
  if (b.website) return json({ ok: true, id: 'x' }); // honeypot

  await loadSchedule();
  const s = spec(b.spec);
  if (!s) throw new HttpError(400, 'bad_service', 'Válassz szakembert.');
  if (s.booking === 'messenger') throw new HttpError(400, 'messenger', `${s.name} az időpontokat Messengeren egyezteti.`);
  const raw = Array.isArray(b.items) ? b.items : (b.svc ? [{ svc: b.svc, length: b.length }] : []);
  const resolved = resolveItems(s, raw);
  if (!DATE_RE.test(b.date || '') || !TIME_RE.test(b.start || '')) throw new HttpError(400, 'bad_time', 'Hibás dátum vagy időpont.');
  const name = clean(b.name, 80), phone = clean(b.phone, 30), email = clean(b.email, 120), note = clean(b.note, 500);
  if (name.length < 2) throw new HttpError(400, 'bad_name', 'Add meg a neved.');
  if (phone.replace(/\D/g, '').length < 8) throw new HttpError(400, 'bad_phone', 'Adj meg egy érvényes telefonszámot.');
  if (!b.consent) throw new HttpError(400, 'consent', 'A foglaláshoz el kell fogadnod az adatkezelést.');

  const now = salonNow();
  if (b.date < now.date || b.date > addDays(now.date, SALON.daysAhead)) throw new HttpError(400, 'out_of_range', 'Erre a napra most nem lehet foglalni.');
  const hours = s.hours[weekday(b.date)];
  if (!hours) throw new HttpError(400, 'closed', `${s.name} ezen a napon nem dolgozik. Kérjük, válassz másik napot.`);
  const start = toMin(b.start), open = toMin(hours[0]), close = toMin(hours[1]);
  if (start < open || start + resolved.dur > close || (start - open) % SALON.stepMinutes) throw new HttpError(400, 'bad_time', 'Ez az időpont nem foglalható (a választott szolgáltatások nem férnek bele a munkaidőbe).');
  if (b.date === now.date && start < now.minutes + SALON.minLeadMinutes) throw new HttpError(400, 'too_soon', 'Ez az időpont már nem foglalható.');

  const gb = (await gcalBusy(s.id, b.date, b.date))[b.date] || [];
  if (overlaps(gb, start, resolved.dur, { fill: resolved.fill, soft: resolved.soft.map(([a, e]) => [start + a, start + e]) })) throw new HttpError(409, 'taken', 'Ez az időpont már foglalt. Kérjük, válassz másikat.');

  const bk = await createBooking({ s, date: b.date, start: b.start, dur: resolved.dur, resolved, contact: { name, phone, email, note }, source: 'online' });
  return json({ ok: true, id: bk.id, booking: { specName: s.name, svcName: bk.svcName, price: bk.price, items: bk.items, date: bk.date, start: bk.start, end: bk.end } });
});
export const config = { path: '/api/book' };
