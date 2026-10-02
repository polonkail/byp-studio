import { json, handle, store, spec, mutateJSON, newId, clean, HttpError } from '../lib/util.mjs';

// Nyilvános vendégkönyv: GET = jóváhagyott bejegyzések, POST = új bejegyzés (jóváhagyásra vár)
export default handle(async req => {
  const st = store('guestbook');
  if (req.method === 'GET') {
    const all = (await st.get('index', { type: 'json' })) || [];
    const entries = all.filter(e => e.status === 'approved')
      .map(({ id, name, spec, rating, text, reply, createdAt }) => ({ id, name, spec, rating, text, reply, createdAt }));
    return json({ entries }, 200, { 'cache-control': 'public, max-age=60' });
  }
  if (req.method !== 'POST') throw new HttpError(405, 'method', 'Nem támogatott.');
  let b; try { b = await req.json(); } catch { throw new HttpError(400, 'bad_json', 'Hibás kérés.'); }
  if (b.website) return json({ ok: true });
  const name = clean(b.name, 60), text = clean(b.text, 1000);
  const rating = Math.round(Number(b.rating));
  if (name.length < 2) throw new HttpError(400, 'bad_name', 'Add meg a neved (keresztnév is elég).');
  if (text.length < 5) throw new HttpError(400, 'bad_text', 'Írj néhány szót a bejegyzésbe.');
  if (!(rating >= 1 && rating <= 5)) throw new HttpError(400, 'bad_rating', 'Adj 1–5 csillagot.');
  if (!b.consent) throw new HttpError(400, 'consent', 'Fogadd el, hogy a bejegyzésed megjelenjen az oldalon.');
  const entry = { id: newId(), name, spec: spec(b.spec)?.id || null, rating, text, reply: '', status: 'pending', createdAt: new Date().toISOString() };
  await mutateJSON(st, 'index', idx => {
    idx = idx || [];
    if (idx.filter(e => e.status === 'pending').length >= 50) throw new HttpError(429, 'busy', 'Most nem tudunk több bejegyzést fogadni, próbáld később.');
    return [entry, ...idx].slice(0, 1000);
  });
  return json({ ok: true });
});
export const config = { path: '/api/guestbook' };
