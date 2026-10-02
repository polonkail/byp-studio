import { handle, store, HttpError } from '../lib/util.mjs';

export default handle(async (req, ctx) => {
  const id = ctx.params.id;
  if (!/^[a-z0-9]{6,32}$/.test(id || '')) throw new HttpError(404, 'not_found');
  const res = await store('gallery').getWithMetadata(`img/${id}`, { type: 'arrayBuffer' });
  if (!res) return new Response('Not found', { status: 404 });
  return new Response(res.data, { headers: { 'content-type': res.metadata?.contentType || 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
});
export const config = { path: '/api/img/:id' };
