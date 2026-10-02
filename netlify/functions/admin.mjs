import { json, handle, store, spec, requireAdmin, mutateJSON, monthKey, newId, clean, salonNow, weekday, toMin, toT, overlaps, HttpError, DATE_RE, TIME_RE } from '../lib/util.mjs';

const IMG_TYPES = ['image/jpeg', 'image/webp', 'image/png'];
const MAX_IMG = 5 * 1024 * 1024;

export default handle(async req => {
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
    const st = store('bookings');
    const { blobs } = await st.list();
    const keys = blobs.map(b => b.key).filter(k => k.slice(0, 10) >= from).sort().slice(0, 400);
    const items = (await Promise.all(keys.map(k => st.get(k, { type: 'json' })))).filter(Boolean);
    items.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
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
    return json({ ok: true });
  }

  // --- block time (szabadság, szünet) ---
  if (route === 'block' && M === 'POST') {
    const b = await req.json();
    const targets = b.spec === 'all' ? ['petra', 'csilla', 'andrea', 'viktoria'].map(spec) : [spec(b.spec)];
    if (!targets[0] || !DATE_RE.test(b.date || '')) throw new HttpError(400, 'bad', 'Válassz szakembert és napot.');
    const created = [];
    for (const s of targets) {
      const hours = s.hours[weekday(b.date)];
      if (!hours) continue;
      const from = TIME_RE.test(b.from || '') ? b.from : hours[0];
      const to = TIME_RE.test(b.to || '') ? b.to : hours[1];
      const start = toMin(from), dur = toMin(to) - start;
      if (dur <= 0) throw new HttpError(400, 'bad', 'A befejezés legyen később, mint a kezdés.');
      const id = newId();
      await mutateJSON(store('days'), monthKey(s.id, b.date), doc => {
        doc = doc || {};
        const items = doc[b.date] || [];
        if (!b.force && overlaps(items, start, dur)) throw new HttpError(409, 'conflict', `${s.name}: erre az időszakra már van foglalás. Előbb mondd le, vagy válassz másik időszakot.`);
        items.push({ start: from, dur, id });
        items.sort((x, y) => x.start.localeCompare(y.start));
        doc[b.date] = items;
        return doc;
      });
      const rec = { id, type: 'block', spec: s.id, specName: s.name, date: b.date, start: from, end: toT(start + dur), dur, note: clean(b.note, 120), createdAt: new Date().toISOString() };
      await store('bookings').setJSON(`${b.date}/${s.id}/${id}`, rec);
      created.push(rec);
    }
    return json({ ok: true, created });
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
