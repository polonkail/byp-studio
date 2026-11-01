import { json, handle, store, mutateJSON } from '../lib/util.mjs';

// Már nem a stúdióban dolgozó szakemberek képei: első lekéréskor véglegesen törlődnek.
const REMOVED_SPECS = ['andrea'];

export default handle(async () => {
  const st = store('gallery');
  let index = (await st.get('index', { type: 'json' })) || [];
  const gone = index.filter(x => REMOVED_SPECS.includes(x.spec));
  if (gone.length) {
    index = await mutateJSON(st, 'index', idx => (idx || []).filter(x => !REMOVED_SPECS.includes(x.spec)));
    await Promise.all(gone.map(x => st.delete(`img/${x.id}`).catch(() => {})));
  }
  return json({ images: index }, 200, { 'cache-control': 'public, max-age=60' });
});
export const config = { path: '/api/gallery' };
