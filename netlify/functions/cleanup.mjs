import { store, salonNow, addDays } from '../lib/util.mjs';

// Naponta lefut: törli a 30 napnál régebbi foglalásokat (adatkezelési tájékoztató szerint).
export default async () => {
  const limit = addDays(salonNow().date, -30);
  const bk = store('bookings');
  const { blobs } = await bk.list();
  const old = blobs.map(b => b.key).filter(k => k.slice(0, 10) < limit);
  for (const k of old) await bk.delete(k);
  const days = store('days');
  const { blobs: months } = await days.list();
  const oldMonths = months.map(b => b.key).filter(k => k.split('/')[1] < limit.slice(0, 7));
  for (const k of oldMonths) await days.delete(k);
  console.log(`cleanup: ${old.length} bookings, ${oldMonths.length} month docs removed`);
};
export const config = { schedule: '@daily' };
