import { json, handle } from '../lib/util.mjs';
import { SALON, SPECIALISTS } from '../lib/config.mjs';

export default handle(async () => json({ salon: SALON, specialists: SPECIALISTS }, 200, { 'cache-control': 'public, max-age=300' }));
export const config = { path: '/api/config' };
