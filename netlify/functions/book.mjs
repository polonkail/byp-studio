import { json, handle, store, spec, salonNow, addDays, weekday, toMin, toT, overlaps, mutateJSON, monthKey, newId, clean, HttpError, DATE_RE, TIME_RE } from '../lib/util.mjs';
import { SALON, LENGTHS } from '../lib/config.mjs';

const ft = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft';

export default handle(async req => {
  if (req.method !== 'POST') throw new HttpError(405, 'method', 'Csak POST.');
  let b; try { b = await req.json(); } catch { throw new HttpError(400, 'bad_json', 'Hibás kérés.'); }
  if (b.website) return json({ ok: true, id: 'x' }); // honeypot: bots fill hidden field

  const s = spec(b.spec);
  const svc = s && s.services.find(v => v.id === b.svc);
  if (!s || !svc) throw new HttpError(400, 'bad_service', 'Válassz szakembert és szolgáltatást.');
  // hajhossz és ár (ha a szolgáltatás ára hajhossztól függ)
  let lenName = '', priceTxt = svc.priceText || (svc.price ? ft(svc.price) : '');
  if (svc.prices) {
    const li = LENGTHS.findIndex(l => l.id === b.length);
    if (li < 0 || svc.prices[li] == null) throw new HttpError(400, 'bad_length', 'Válaszd ki a hajhosszt.');
    lenName = LENGTHS[li].name.toLowerCase(); priceTxt = ft(svc.prices[li]);
  }
  const svcLabel = [svc.catName, svc.name, lenName].filter(Boolean).join(' · ');
  if (!DATE_RE.test(b.date || '') || !TIME_RE.test(b.start || '')) throw new HttpError(400, 'bad_time', 'Hibás dátum vagy időpont.');
  const name = clean(b.name, 80), phone = clean(b.phone, 30), email = clean(b.email, 120), note = clean(b.note, 500);
  if (name.length < 2) throw new HttpError(400, 'bad_name', 'Add meg a neved.');
  if (phone.replace(/\D/g, '').length < 8) throw new HttpError(400, 'bad_phone', 'Adj meg egy érvényes telefonszámot.');
  if (!b.consent) throw new HttpError(400, 'consent', 'A foglaláshoz el kell fogadnod az adatkezelést.');

  const now = salonNow();
  if (b.date < now.date || b.date > addDays(now.date, SALON.daysAhead)) throw new HttpError(400, 'out_of_range', 'Erre a napra most nem lehet foglalni.');
  const hours = s.hours[weekday(b.date)];
  if (!hours) throw new HttpError(400, 'closed', 'Ezen a napon zárva vagyunk.');
  const start = toMin(b.start), open = toMin(hours[0]), close = toMin(hours[1]);
  if (start < open || start + svc.dur > close || (start - open) % SALON.stepMinutes) throw new HttpError(400, 'bad_time', 'Ez az időpont nem foglalható.');
  if (b.date === now.date && start < now.minutes + SALON.minLeadMinutes) throw new HttpError(400, 'too_soon', 'Ez az időpont már nem foglalható.');

  const id = newId();
  await mutateJSON(store('days'), monthKey(s.id, b.date), doc => {
    doc = doc || {};
    const items = doc[b.date] || [];
    if (overlaps(items, start, svc.dur)) throw new HttpError(409, 'taken', 'Ezt az időpontot közben valaki lefoglalta. Válassz egy másikat.');
    items.push({ start: b.start, dur: svc.dur, id });
    items.sort((x, y) => x.start.localeCompare(y.start));
    doc[b.date] = items;
    return doc;
  });

  const booking = { id, type: 'booking', spec: s.id, specName: s.name, svc: svc.id, svcName: svcLabel, price: priceTxt, length: lenName || null, date: b.date, start: b.start, end: toT(start + svc.dur), dur: svc.dur, name, phone, email, note, createdAt: new Date().toISOString() };
  await store('bookings').setJSON(`${b.date}/${s.id}/${id}`, booking);
  return json({ ok: true, id, booking: { specName: s.name, svcName: svcLabel, price: priceTxt, length: lenName || null, date: b.date, start: b.start, end: booking.end } });
});
export const config = { path: '/api/book' };
