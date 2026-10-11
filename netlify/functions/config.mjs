import { json, handle, loadSchedule } from '../lib/util.mjs';
import { SALON, SPECIALISTS, LENGTHS } from '../lib/config.mjs';

export default handle(async () => { await loadSchedule(); return json({ salon: SALON, specialists: SPECIALISTS, lengths: LENGTHS }, 200, { 'cache-control': 'no-store' }); });
export const config = { path: '/api/config' };
