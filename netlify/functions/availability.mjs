import { json, handle, store, spec, salonNow, addDays, HttpError } from '../lib/util.mjs';
import { SALON } from '../lib/config.mjs';

// Returns busy intervals (start, duration) per day for one specialist. No personal data.
export default handle(async req => {
  const url = new URL(req.url);
  const s = spec(url.searchParams.get('spec'));
  if (!s) throw new HttpError(400, 'bad_spec', 'Ismeretlen szakember.');
  const now = salonNow();
  const last = addDays(now.date, SALON.daysAhead);
  const months = [...new Set([now.date.slice(0, 7), last.slice(0, 7)])];
  const st = store('days');
  const days = {};
  for (const m of months) {
    const doc = await st.get(`${s.id}/${m}`, { type: 'json' });
    for (const [date, items] of Object.entries(doc || {})) {
      if (date >= now.date && date <= last) days[date] = items.map(({ start, dur }) => ({ start, dur }));
    }
  }
  return json({ spec: s.id, today: now.date, nowMinutes: now.minutes, until: last, days });
});
export const config = { path: '/api/availability' };
