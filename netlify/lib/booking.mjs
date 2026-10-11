// Közös foglalási logika: szolgáltatások ellenőrzése, időpont lefoglalása, statisztika.
import { store, mutateJSON, monthKey, newId, toMin, toT, overlaps, HttpError } from './util.mjs';
import { LENGTHS } from './config.mjs';
import { gcalPush } from './gcal.mjs';

export const ft = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft';

/** items: [{svc, length}] → ellenőrzött tételek, összidő, felirat, ár */
export function resolveItems(s, rawItems, { requireLength = true } = {}) {
  if (!Array.isArray(rawItems) || !rawItems.length) throw new HttpError(400, 'bad_service', 'Válassz legalább egy szolgáltatást.');
  if (rawItems.length > 8) throw new HttpError(400, 'bad_service', 'Egyszerre legfeljebb 8 szolgáltatás foglalható.');
  const seen = new Set();
  const items = rawItems.map(r => {
    const v = s.services.find(x => x.id === r.svc);
    if (!v || seen.has(v.id)) throw new HttpError(400, 'bad_service', 'Ismeretlen vagy ismételt szolgáltatás.');
    seen.add(v.id);
    let lenName = '', num = v.price || null, txt = v.priceText || (v.price ? ft(v.price) : '');
    if (v.prices) {
      const li = LENGTHS.findIndex(l => l.id === r.length);
      if (li < 0 || v.prices[li] == null) {
        if (requireLength) throw new HttpError(400, 'bad_length', `Válaszd ki a hajhosszt ennél: ${v.name}.`);
      } else { lenName = LENGTHS[li].name.toLowerCase(); num = v.prices[li]; txt = ft(num); }
    }
    return { svc: v.id, name: v.name, cat: v.catName || null, length: lenName || null, dur: v.dur, price: num, priceText: txt,
      label: [v.catName, v.name, lenName].filter(Boolean).join(' · ') };
  });
  const dur = items.reduce((a, i) => a + i.dur, 0);
  const label = items.map(i => i.label).join(' + ');
  const textOnly = items.filter(i => !i.price || i.priceText.includes('/') || i.priceText.includes('tól') || i.priceText.includes('–'));
  const numeric = items.filter(i => !textOnly.includes(i));
  let price = '';
  if (numeric.length) price = ft(numeric.reduce((a, i) => a + i.price, 0));
  if (textOnly.length) price = [price, ...textOnly.map(i => i.priceText)].filter(Boolean).join(' + ');
  return { items, dur, label, price, priceSum: numeric.reduce((a, i) => a + i.price, 0) };
}

/** Lefoglalja az időpontot a naptárban, elmenti a foglalást és a névtelen statisztikát. */
export async function createBooking({ s, date, start, dur, resolved, contact, source, force = false, extraLabel = '' }) {
  const id = newId();
  const startMin = toMin(start);
  await mutateJSON(store('days'), monthKey(s.id, date), doc => {
    doc = doc || {};
    const items = doc[date] || [];
    if (!force && overlaps(items, startMin, dur)) throw new HttpError(409, 'taken', 'Ezt az időpontot közben valaki lefoglalta. Válassz egy másikat.');
    items.push({ start, dur, id });
    items.sort((x, y) => x.start.localeCompare(y.start));
    doc[date] = items;
    return doc;
  });
  const svcName = [resolved?.label, extraLabel].filter(Boolean).join(' + ') || 'Foglalás';
  const booking = {
    id, type: 'booking', source, spec: s.id, specName: s.name,
    items: resolved ? resolved.items.map(({ svc, name, cat, length, price, priceText }) => ({ svc, name, cat, length, price, priceText })) : [],
    svcName, price: resolved?.price || '', date, start, end: toT(startMin + dur), dur,
    ...contact, createdAt: new Date().toISOString(),
  };
  await store('bookings').setJSON(`${date}/${s.id}/${id}`, booking);
  await addStat(booking);
  await gcalPush(booking);
  return booking;
}

// ---- névtelen statisztika (személyes adat nélkül; a foglalások törlése után is megmarad) ----
const statKey = date => `svc/${date.slice(0, 7)}`;
export async function addStat(b) {
  const entry = { id: b.id, d: b.date, spec: b.spec, src: b.source,
    items: (b.items || []).map(i => ({ svc: i.svc, name: i.name, cat: i.cat, len: i.length, p: i.price && !String(i.priceText).includes('/') ? i.price : 0 })) };
  if (!entry.items.length) entry.items = [{ svc: 'egyeb', name: b.svcName || 'Egyéb', cat: null, len: null, p: 0 }];
  await mutateJSON(store('stats'), statKey(b.date), doc => [...(doc || []).filter(x => x.id !== b.id), entry]);
}
export async function removeStat(date, id) {
  const st = store('stats');
  if (!(await st.get(statKey(date)))) return;
  await mutateJSON(st, statKey(date), doc => (doc || []).filter(x => x.id !== id));
}
