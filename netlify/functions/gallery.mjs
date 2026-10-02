import { json, handle, store } from '../lib/util.mjs';

export default handle(async () => {
  const index = (await store('gallery').get('index', { type: 'json' })) || [];
  return json({ images: index }, 200, { 'cache-control': 'public, max-age=60' });
});
export const config = { path: '/api/gallery' };
