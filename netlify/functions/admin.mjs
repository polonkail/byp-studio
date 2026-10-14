import { json, handle, store, spec, requireAdmin, mutateJSON, monthKey, newId, clean, salonNow, weekday, toMin, toT, overlaps, HttpError, DATE_RE, TIME_RE, loadSchedule, defaultHours, addDays } from '../lib/util.mjs';
import { resolveItems, createBooking, removeStat, annotate, migrateMonth } from '../lib/booking.mjs';
import { gcalPush, gcalRemove, gcalBusy, gcalEnabled, gcalDiagnose } from '../lib/gcal.mjs';

const IMG_TYPES = ['image/jpeg', 'image/webp', 'image/png'];
const MAX_IMG = 5 * 1024 * 1024;

export default handle(async req => {
  await loadSchedule();
  requireAdmin(req);
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/admin\/?/, '');
  const M = req.method;

  // --- login check ---
  if (route === 'login' && M === 'POST') return json({ ok: true });

  // --- gallery upload: raw image body ---
  if (route === 'upload' && M === 'POST') {
    const type = (req.headers.get('content-type') || '').split(';')[0].trim();
    if (!IMG_TYPES.includes(type)) throw new HttpError(415, 'type', 'Csak JPG, PNG vagy WEBP kép tölthető fel.');
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) throw new HttpError(400, 'empty', 'Üres fájl.');
    if (buf.byteLength > MAX_IMG) throw new HttpError(413, 'too_large', 'A kép túl nagy (legfeljebb 5 MB).');
    const s = spec(url.searchParams.get('spec'));
    const caption = clean(url.searchParams.get('caption'), 80);
    const w = Number(url.searchParams.get('w')) || null, h = Number(url.searchParams.get('h')) || null;
    const id = newId();
    const st = store('gallery');
    await st.set(`img/${id}`, buf, { metadata: { contentType: type } });
    const item = { id, spec: s ? s.id : null, caption, w, h, createdAt: new Date().toISOString() };
    await mutateJSON(st, 'index', idx => [item, ...(idx || [])]);
    return json({ ok: true, image: item });
  }

  // --- gallery delete ---
  const gm = route.match(/^gallery\/([a-z0-9]{6,32})$/);
  if (gm && M === 'DELETE') {
    const st = store('gallery');
    await mutateJSON(st, 'index', idx => (idx || []).filter(x => x.id !== gm[1]));
    await st.delete(`img/${gm[1]}`);
    return json({ ok: true });
  }

  // --- gallery reorder / caption edit ---
  if (gm && M === 'PATCH') {
    const b = await req.json();
    await mutateJSON(store('gallery'), 'index', idx => (idx || []).map(x => x.id === gm[1]
      ? { ...x, caption: b.caption !== undefined ? clean(b.caption, 80) : x.caption, spec: b.spec !== undefined ? (spec(b.spec)?.id || null) : x.spec }
      : x));
    return json({ ok: true });
  }

  // --- bookings list (from a date, default today) ---
  if (route === 'bookings' && M === 'GET') {
    const from = DATE_RE.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : salonNow().date;
    const to = DATE_RE.test(url.searchParams.get('to') || '') ? url.searchParams.get('to') : '9999-12-31';
    const st = store('bookings');
    const { blobs } = await st.list();
    const keys = blobs.map(b => b.key).filter(k => k.slice(0, 10) >= from && k.slice(0, 10) <= to).sort().slice(0, 400);
    const items = (await Promise.all(keys.map(k => st.get(k, { type: 'json' })))).filter(Boolean);
    items.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    for (const b of items) {
      const s = spec(b.spec);
      if (b.type === 'booking' && s) { const a = annotate(s, { start: b.start, dur: b.dur, svcs: (b.items || []).map(i => i.svc) }); b.soft = a.soft; b.fill = a.fill; }
    }
    return json({ from, bookings: items });
  }

  // --- cancel a booking or a block ---
  if (route === 'cancel' && M === 'POST') {
    const b = await req.json();
    if (!DATE_RE.test(b.date || '') || !spec(b.spec) || !/^[a-z0-9]{6,32}$/.test(b.id || '')) throw new HttpError(400, 'bad', 'Hibás kérés.');
    await mutateJSON(store('days'), monthKey(b.spec, b.date), doc => {
      doc = doc || {};
      doc[b.date] = (doc[b.date] || []).filter(x => x.id !== b.id);
      if (!doc[b.date].length) delete doc[b.date];
      return doc;
    });
    await store('bookings').delete(`${b.date}/${b.spec}/${b.id}`);
    await removeStat(b.date, b.id);
    await gcalRemove(b.spec, b.id);
    return json({ ok: true });
  }

  // --- block time (szabadság, szünet): egy nap vagy -tól -ig időszak ---
  if (route === 'block' && M === 'POST') {
    const b = await req.json();
    const targets = b.spec === 'all' ? ['petra', 'csilla', 'andrea', 'viktoria'].map(spec) : [spec(b.spec)];
    if (!targets[0] || !DATE_RE.test(b.date || '')) throw new HttpError(400, 'bad', 'Válassz szakembert és napot.');
    const last = DATE_RE.test(b.dateTo || '') && b.dateTo > b.date ? b.dateTo : b.date;
    const dates = [];
    for (let d = b.date; d <= last && dates.length < 120; d = addDays(d, 1)) dates.push(d);
    if (dates.length >= 120) throw new HttpError(400, 'bad', 'Legfeljebb 4 hónapos időszakot zárhatsz le egyszerre.');
    const group = dates.length > 1 || targets.length > 1 ? newId() : undefined;
    // 1) ellenőrzés: van-e foglalás az érintett időszakokban
    const plan = [], conflicts = [];
    for (const s of targets) for (const date of dates) {
      const hours = s.hours[weekday(date)];
      if (!hours) continue;
      const from = TIME_RE.test(b.from || '') ? b.from : hours[0];
      const to = TIME_RE.test(b.to || '') ? b.to : hours[1];
      const start = toMin(from), dur = toMin(to) - start;
      if (dur <= 0) throw new HttpError(400, 'bad', 'A befejezés legyen később, mint a kezdés.');
      const doc = await migrateMonth(s, monthKey(s.id, date));
      if (!b.force && overlaps((doc?.[date] || []).map(i => annotate(s, i)), start, dur)) conflicts.push(`${date.slice(5).replace('-', '.')}. (${s.short || s.name})`);
      plan.push({ s, date, from, start, dur });
    }
    if (conflicts.length) throw new HttpError(409, 'conflict', `Ezeken a napokon már van foglalás: ${conflicts.join(', ')}. Előbb mondd le őket, vagy válassz másik időszakot.`);
    // 2) lezárás
    const created = [];
    for (const { s, date, from, start, dur } of plan) {
      const id = newId();
      await mutateJSON(store('days'), monthKey(s.id, date), doc => {
        doc = doc || {};
        const items = doc[date] || [];
        items.push({ start: from, dur, id, svcs: [] });
        items.sort((x, y) => x.start.localeCompare(y.start));
        doc[date] = items;
        return doc;
      });
      const rec = { id, type: 'block', spec: s.id, specName: s.name, date, start: from, end: toT(start + dur), dur, note: clean(b.note, 120), ...(group ? { group } : {}), createdAt: new Date().toISOString() };
      await store('bookings').setJSON(`${date}/${s.id}/${id}`, rec);
      await gcalPush(rec);
      created.push(rec);
    }
    return json({ ok: true, created });
  }

  // --- a beállított (mai és jövőbeli) szabadságok, zárások listája ---
  if (route === 'blocks' && M === 'GET') {
    const today = salonNow().date, st = store('bookings');
    const { blobs } = await st.list();
    const keys = blobs.map(x => x.key).filter(k => k.slice(0, 10) >= today);
    const recs = (await Promise.all(keys.map(k => st.get(k, { type: 'json' })))).filter(r => r && r.type === 'block');
    recs.sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start));
    return json({ blocks: recs });
  }

  // --- szabadság / zárás visszavonása (több nap egyszerre) ---
  if (route === 'unblock' && M === 'POST') {
    const b = await req.json();
    const list = Array.isArray(b.items) ? b.items.slice(0, 400) : [];
    for (const it of list) {
      if (!DATE_RE.test(it.date || '') || !spec(it.spec) || !/^[a-z0-9]{6,32}$/.test(it.id || '')) continue;
      const rec = await store('bookings').get(`${it.date}/${it.spec}/${it.id}`, { type: 'json' });
      if (!rec || rec.type !== 'block') continue; // csak zárást lehet így törölni
      await mutateJSON(store('days'), monthKey(it.spec, it.date), doc => {
        doc = doc || {};
        doc[it.date] = (doc[it.date] || []).filter(x => x.id !== it.id);
        if (!doc[it.date].length) delete doc[it.date];
        return doc;
      });
      await store('bookings').delete(`${it.date}/${it.spec}/${it.id}`);
      await gcalRemove(it.spec, it.id);
    }
    return json({ ok: true });
  }

  // --- telefonos / kézi foglalás rögzítése ---
  if (route === 'manual-book' && M === 'POST') {
    const b = await req.json();
    const s = spec(b.spec);
    if (!s) throw new HttpError(400, 'bad', 'Válassz szakembert.');
    if (!DATE_RE.test(b.date || '') || !TIME_RE.test(b.start || '')) throw new HttpError(400, 'bad', 'Add meg a napot és a kezdést.');
    const extra = clean(b.extra, 120);
    const resolved = (b.items || []).length ? resolveItems(s, b.items, { requireLength: false }) : null;
    if (!resolved && !extra) throw new HttpError(400, 'bad', 'Válassz szolgáltatást, vagy írd be, mire jön a vendég.');
    const dur = Math.round(Number(b.dur) || resolved?.dur || 30);
    if (dur < 10 || dur > 720) throw new HttpError(400, 'bad', 'Az időtartam 10 perc és 12 óra között legyen.');
    const name = clean(b.name, 80);
    if (name.length < 2) throw new HttpError(400, 'bad', 'Add meg a vendég nevét.');
    const bk = await createBooking({ s, date: b.date, start: b.start, dur, resolved, extraLabel: extra, force: !!b.force,
      contact: { name, phone: clean(b.phone, 30), email: '', note: clean(b.note, 500) }, source: 'telefon' });
    return json({ ok: true, booking: bk });
  }

  // --- látogatottság ---
  if (route === 'visits' && M === 'GET') {
    const st = store('stats');
    const { blobs } = await st.list({ prefix: 'visits/' });
    const days = [];
    for (const { key } of blobs) {
      const doc = (await st.get(key, { type: 'json' })) || {};
      const ym = key.slice(7);
      for (const [d, v] of Object.entries(doc)) days.push({ date: `${ym}-${d}`, pv: v.pv || 0, uv: (v.u || []).length });
    }
    days.sort((a, b) => a.date.localeCompare(b.date));
    return json({ today: salonNow().date, days });
  }

  // --- szolgáltatás-statisztika (névtelen bejegyzések) ---
  if (route === 'stats' && M === 'GET') {
    const st = store('stats');
    const { blobs } = await st.list({ prefix: 'svc/' });
    const entries = [];
    for (const { key } of blobs) entries.push(...((await st.get(key, { type: 'json' })) || []));
    return json({ today: salonNow().date, entries });
  }

  // --- heti munkarend / szabadnapok ---
  if (route === 'schedule' && M === 'GET') {
    const out = {};
    for (const id of ['petra', 'csilla', 'andrea', 'viktoria']) out[id] = { hours: spec(id).hours, defaults: defaultHours(id) };
    return json({ schedule: out });
  }
  if (route === 'schedule' && M === 'POST') {
    const b = await req.json();
    const s = spec(b.spec);
    if (!s) throw new HttpError(400, 'bad', 'Válassz szakembert.');
    const hours = {};
    for (let d = 0; d <= 6; d++) {
      const h = b.hours?.[d];
      if (!h) continue;
      if (!TIME_RE.test(h[0] || '') || !TIME_RE.test(h[1] || '') || toMin(h[1]) <= toMin(h[0])) throw new HttpError(400, 'bad', 'Minden munkanapnál add meg a kezdést és a befejezést (a befejezés legyen később).');
      hours[d] = [h[0], h[1]];
    }
    await mutateJSON(store('settings'), 'schedule', doc => ({ ...(doc || {}), [s.id]: hours }));
    s.hours = hours;
    // figyelmeztetés: jövőbeli foglalások olyan napon, ami most szabadnap lett
    const today = salonNow().date;
    const { blobs } = await store('bookings').list();
    const conflicts = blobs.map(x => x.key).filter(k => k.slice(0, 10) >= today && k.split('/')[1] === s.id && !hours[weekday(k.slice(0, 10))]).map(k => k.slice(0, 10));
    return json({ ok: true, conflicts: [...new Set(conflicts)].sort() });
  }

  // --- Google Naptár foglaltság egy napra (a kezelőfelület naptárához) ---
  // --- e-mail értesítés: próbalevél ---
  if (route === 'mail-test' && M === 'POST') {
    const { mailEnabled, recipientsFor, sendMail } = await import('../lib/notify.mjs');
    if (!mailEnabled()) return json({ ok: false, msg: 'Nincs beállítva az SMTP_USER és/vagy az SMTP_PASS környezeti változó (vagy beállítás után nem volt új deploy).' });
    const out = [];
    for (const id of ['petra', 'csilla']) {
      const to = recipientsFor(id);
      if (!to.length) { out.push({ spec: id, ok: null, msg: `Nincs címzett (NOTIFY_${id.toUpperCase()}).` }); continue; }
      try { await sendMail({ to: to.join(','), subject: 'BYP Stúdió – próba értesítés', text: 'Ez egy próbalevél. Ha megkaptad, az új online foglalásokról is kapsz majd értesítést.' }); out.push({ spec: id, ok: true, msg: 'Elküldve: ' + to.join(', ') }); }
      catch (e) { out.push({ spec: id, ok: false, msg: /Invalid login|BadCredentials|535/i.test(e.message) ? 'A Gmail nem fogadta el a belépést. Az SMTP_PASS-ba alkalmazásjelszó kell (nem a sima Gmail-jelszó), és a fióknál be kell legyen kapcsolva a kétlépcsős azonosítás.' : 'Hiba: ' + e.message }); }
    }
    return json({ ok: true, results: out });
  }
  // --- Google Naptár: kapcsolat ellenőrzése ---
  if (route === 'gcal-test' && M === 'GET') {
    const ids = ['petra', 'csilla', 'andrea', 'viktoria'].filter(id => spec(id) && spec(id).booking !== 'messenger');
    return json(await gcalDiagnose(ids));
  }
  // --- Google Naptár: a már meglévő (mai és jövőbeli) foglalások felírása ---
  if (route === 'gcal-sync' && M === 'POST') {
    const from = salonNow().date, st = store('bookings');
    const { blobs } = await st.list();
    let n = 0;
    for (const k of blobs.map(b => b.key).filter(k => k.slice(0, 10) >= from)) {
      const b = await st.get(k, { type: 'json' });
      if (b && gcalEnabled(b.spec)) { await gcalPush(b); n++; }
    }
    return json({ ok: true, count: n });
  }
  if (route === 'gbusy' && M === 'GET') {
    const date = url.searchParams.get('date');
    if (!DATE_RE.test(date || '')) throw new HttpError(400, 'bad', 'Hibás dátum.');
    const out = {};
    for (const id of ['petra', 'csilla', 'andrea', 'viktoria']) if (gcalEnabled(id)) out[id] = (await gcalBusy(id, date, date))[date] || [];
    return json({ busy: out });
  }

  // --- guestbook moderation ---
  if (route === 'guestbook' && M === 'GET') {
    return json({ entries: (await store('guestbook').get('index', { type: 'json' })) || [] });
  }
  const gb = route.match(/^guestbook\/([a-z0-9]{6,32})$/);
  if (gb && M === 'POST') {
    const b = await req.json();
    await mutateJSON(store('guestbook'), 'index', idx => {
      idx = idx || [];
      if (b.action === 'delete') return idx.filter(e => e.id !== gb[1]);
      return idx.map(e => e.id !== gb[1] ? e : {
        ...e,
        status: b.action === 'approve' ? 'approved' : b.action === 'hide' ? 'hidden' : e.status,
        reply: b.reply !== undefined ? clean(b.reply, 600) : e.reply,
      });
    });
    return json({ ok: true });
  }

  // --- private feedback ---
  if (route === 'feedback' && M === 'GET') {
    return json({ items: (await store('feedback').get('index', { type: 'json' })) || [] });
  }
  const fb = route.match(/^feedback\/([a-z0-9]{6,32})$/);
  if (fb && M === 'POST') {
    const b = await req.json();
    await mutateJSON(store('feedback'), 'index', idx => {
      idx = idx || [];
      if (b.action === 'delete') return idx.filter(x => x.id !== fb[1]);
      return idx.map(x => x.id !== fb[1] ? x : { ...x, read: b.action === 'unread' ? false : true });
    });
    return json({ ok: true });
  }

  // --- counters for tab badges ---
  if (route === 'counts' && M === 'GET') {
    const g = (await store('guestbook').get('index', { type: 'json' })) || [];
    const f = (await store('feedback').get('index', { type: 'json' })) || [];
    return json({ guestbookPending: g.filter(e => e.status === 'pending').length, feedbackUnread: f.filter(x => !x.read).length });
  }

  throw new HttpError(404, 'not_found', 'Ismeretlen művelet.');
});

export const config = { path: ['/api/admin/*'] };
