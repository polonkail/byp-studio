import { json, handle, store, spec, salonNow, addDays, HttpError, loadSchedule } from '../lib/util.mjs';
import { SALON } from '../lib/config.mjs';
import { gcalBusy } from '../lib/gcal.mjs';
import { annotate, migrateMonth } from '../lib/booking.mjs';

// Returns busy intervals (start, duration) per day for one specialist. No personal data.
export default handle(async req => {
  await loadSchedule();
  const url = new URL(req.url);
  const s = spec(url.searchParams.get('spec'));
  if (!s) throw new HttpError(400, 'bad_spec', 'Ismeretlen szakember.');
  const now = salonNow();
  const last = addDays(now.date, SALON.daysAhead);
  const months = [];
  for (let m = now.date.slice(0, 7); m <= last.slice(0, 7); m = addDays(m + '-28', 5).slice(0, 7)) months.push(m);
  const days = {};
  const docs = await Promise.all(months.map(m => migrateMonth(s, `${s.id}/${m}`)));
  for (const doc of docs) {
    for (const [date, items] of Object.entries(doc || {})) {
      if (date >= now.date && date <= last) days[date] = items.map(i => { const a = annotate(s, i); return { start: a.start, dur: a.dur, ...(a.fill ? { fill: true } : {}), ...(a.soft?.length ? { soft: a.soft } : {}) }; });
    }
  }
  // a szakember Google Naptárában lévő egyéb bejegyzések is foglaltnak számítanak
  const gbusy = await gcalBusy(s.id, now.date, last);
  for (const [date, items] of Object.entries(gbusy)) if (date >= now.date && date <= last) days[date] = [...(days[date] || []), ...items];
  return json({ spec: s.id, today: now.date, nowMinutes: now.minutes, until: last, days });
});
export const config = { path: '/api/availability' };
