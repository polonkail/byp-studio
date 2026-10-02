import { json, handle, store, spec, mutateJSON, newId, clean, HttpError } from '../lib/util.mjs';

const TOPICS = ['Dicséret', 'Javaslat', 'Panasz', 'Kérdés', 'Egyéb'];

// Privát visszajelzés a stúdiónak: csak a kezelőfelületen látszik
export default handle(async req => {
  if (req.method !== 'POST') throw new HttpError(405, 'method', 'Csak POST.');
  let b; try { b = await req.json(); } catch { throw new HttpError(400, 'bad_json', 'Hibás kérés.'); }
  if (b.website) return json({ ok: true });
  const text = clean(b.text, 2000);
  if (text.length < 5) throw new HttpError(400, 'bad_text', 'Írd le pár szóban a visszajelzésed.');
  const contact = clean(b.contact, 120);
  if (contact && !b.consent) throw new HttpError(400, 'consent', 'Ha elérhetőséget adsz meg, fogadd el az adatkezelést.');
  const item = { id: newId(), topic: TOPICS.includes(b.topic) ? b.topic : 'Egyéb', spec: spec(b.spec)?.id || null, name: clean(b.name, 60), contact, text, read: false, createdAt: new Date().toISOString() };
  await mutateJSON(store('feedback'), 'index', idx => {
    idx = idx || [];
    if (idx.filter(x => !x.read).length >= 200) throw new HttpError(429, 'busy', 'Most nem tudunk több üzenetet fogadni, próbáld később.');
    return [item, ...idx].slice(0, 1000);
  });
  return json({ ok: true });
});
export const config = { path: '/api/feedback' };
