import { json, handle } from '../lib/util.mjs';
import { SALON, SPECIALISTS, LENGTHS } from '../lib/config.mjs';

export default handle(async () => json({ salon: SALON, specialists: SPECIALISTS, lengths: LENGTHS }, 200, { 'cache-control': 'public, max-age=300' }));
export const config = { path: '/api/config' };
