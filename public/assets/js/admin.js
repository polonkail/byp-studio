(() => {
  const $ = s => document.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : String(k));
    return e;
  };
  const KEY = 'byp-admin-pw';
  const TABS = ['naptar', 'statisztika', 'galeria', 'foglalasok', 'zaras', 'vendegkonyv', 'visszajelzes'];
  let PW = ''; try { PW = sessionStorage.getItem(KEY) || ''; } catch {}
  let CFG = null, images = [], bookings = [], bkFilter = 'all';

  const api = async (path, opts = {}) => {
    const r = await fetch(path, { ...opts, headers: { ...(opts.headers || {}), 'x-admin-password': PW } });
    let data = null; try { data = await r.json(); } catch {}
    if (r.status === 401) { logout('Lejárt vagy hibás jelszó. Lépj be újra.'); throw new Error('unauthorized'); }
    if (!r.ok) throw new Error(data?.message || 'Hiba történt.');
    return data;
  };
  const fmtDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long' }); };
  const specName = id => CFG.specialists.find(s => s.id === id)?.name || 'Stúdió';
  const armed = (btn, label, fn) => {
    btn.addEventListener('click', async () => {
      if (!btn.classList.contains('arm')) { btn.classList.add('arm'); btn.textContent = 'Biztos?'; setTimeout(() => { if (!btn.disabled) { btn.classList.remove('arm'); btn.textContent = label; } }, 3500); return; }
      btn.disabled = true; btn.textContent = '…';
      try { await fn(); } catch (e) { btn.disabled = false; btn.classList.remove('arm'); btn.textContent = label; alertMsg(e.message); }
    });
  };
  const alertMsg = m => window.alert(m);

  /* ---------- login ---------- */
  function logout(msg) {
    PW = ''; try { sessionStorage.removeItem(KEY); } catch {}
    $('#loginForm').hidden = false; $('#tabs').hidden = true;
    TABS.forEach(t => $('#tab-' + t).hidden = true); $('#visitStrip').hidden = true;
    $('#loginMsg').textContent = msg || '';
  }
  $('#logout').addEventListener('click', () => logout(''));
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); PW = $('#pw').value; $('#loginMsg').textContent = '';
    try { await api('/api/admin/login', { method: 'POST' }); try { sessionStorage.setItem(KEY, PW); } catch {} enter(); }
    catch (err) { if (err.message !== 'unauthorized') $('#loginMsg').textContent = err.message; }
  });
  async function enter() {
    $('#loginForm').hidden = true; $('#tabs').hidden = false;
    if (!CFG) CFG = await (await fetch('/api/config')).json();
    const opts = CFG.specialists.map(s => el('option', { value: s.id }, s.name));
    $('#upSpec').replaceChildren(el('option', { value: '' }, 'Stúdió (általános)'), ...opts.map(o => o.cloneNode(true)));
    $('#blSpec').replaceChildren(el('option', { value: 'all' }, 'Mindenki (az egész stúdió)'), ...opts);
    showTab(location.hash.slice(1) || 'naptar');
    loadVisits();
  }
  function showTab(t) {
    if (!TABS.includes(t)) t = 'naptar';
    document.querySelectorAll('.tab[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    TABS.forEach(x => $('#tab-' + x).hidden = x !== t);
    history.replaceState(null, '', '#' + t);
    if (t === 'naptar') loadCal();
    if (t === 'statisztika') { renderVisits(); loadStats(); loadVisits(); }
    if (t === 'galeria') loadImages();
    if (t === 'foglalasok') loadBookings();
    if (t === 'zaras') { loadSched(); loadBlocks(); }
    if (t === 'vendegkonyv') loadGb();
    if (t === 'visszajelzes') loadFb();
    loadCounts();
  }
  document.querySelectorAll('.tab[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  addEventListener('hashchange', () => { if (PW && !$('#tabs').hidden) showTab(location.hash.slice(1)); });

  /* ---------- gallery ---------- */
  async function loadImages() {
    try { images = (await (await fetch('/api/gallery', { cache: 'no-store' })).json()).images || []; } catch { images = []; }
    renderImages();
  }
  function renderImages() {
    $('#imgCount').textContent = images.length ? `${images.length} kép` : '';
    const g = $('#agrid'); g.replaceChildren();
    if (!images.length) { g.append(el('p', { class: 'muted' }, 'Még nincs feltöltött kép.')); return; }
    for (const it of images) {
      const sel = el('select', { 'aria-label': 'Szakember' }, el('option', { value: '' }, 'Stúdió (általános)'), CFG.specialists.map(s => el('option', { value: s.id, selected: it.spec === s.id }, s.short || s.name)));
      const cap = el('input', { value: it.caption || '', maxlength: '80', placeholder: 'Felirat', 'aria-label': 'Felirat' });
      const save = async () => { try { await api('/api/admin/gallery/' + it.id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caption: cap.value, spec: sel.value }) }); it.caption = cap.value; it.spec = sel.value || null; } catch (e) { alertMsg(e.message); } };
      sel.addEventListener('change', save); cap.addEventListener('change', save);
      const del = el('button', { class: 'mini danger', type: 'button' }, 'Törlés');
      armed(del, 'Törlés', async () => { await api('/api/admin/gallery/' + it.id, { method: 'DELETE' }); images = images.filter(x => x.id !== it.id); renderImages(); });
      g.append(el('div', { class: 'aimg' }, el('img', { src: '/api/img/' + it.id, alt: it.caption || '', loading: 'lazy' }), el('div', { class: 'meta' }, sel, cap, del)));
    }
  }
  async function shrink(file) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { throw new Error('Ezt a képet a böngésző nem tudja megnyitni (pl. HEIC). Mentsd el JPG-ként, és próbáld újra.'); }
    const max = 2000, k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    let blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.85));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
    return { blob, w, h };
  }
  async function uploadAll(files) {
    files = [...files].filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) return;
    const q = $('#queue');
    for (const f of files) {
      const line = el('p', {}, `${f.name}: feldolgozás…`); q.prepend(line);
      try {
        const { blob, w, h } = await shrink(f);
        const qs = new URLSearchParams({ spec: $('#upSpec').value, caption: $('#upCap').value.trim(), w, h });
        const r = await api('/api/admin/upload?' + qs, { method: 'POST', headers: { 'content-type': blob.type }, body: blob });
        images.unshift(r.image); renderImages();
        line.className = 'ok'; line.textContent = `${f.name}: feltöltve`;
      } catch (e) { line.className = 'err'; line.textContent = `${f.name}: ${e.message}`; }
    }
  }
  $('#pick').addEventListener('click', () => $('#file').click());
  $('#file').addEventListener('change', e => { uploadAll(e.target.files); e.target.value = ''; });
  const drop = $('#drop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); uploadAll(e.dataTransfer.files); });

  /* ---------- bookings ---------- */
  async function loadBookings() {
    $('#bkList').replaceChildren(el('p', { class: 'muted' }, 'Betöltés…'));
    try { bookings = (await api('/api/admin/bookings')).bookings; renderBookings(); }
    catch (e) { if (e.message !== 'unauthorized') $('#bkList').replaceChildren(el('p', { class: 'status err' }, e.message)); }
  }
  function renderBookings() {
    const f = $('#bkFilter'); f.replaceChildren();
    for (const [id, lab] of [['all', 'Mindenki'], ...CFG.specialists.map(s => [s.id, s.short || s.name])])
      f.append(el('button', { class: 'fchip', type: 'button', 'aria-pressed': String(bkFilter === id), onclick: () => { bkFilter = id; renderBookings(); } }, lab));
    const list = bookings.filter(b => bkFilter === 'all' || b.spec === bkFilter);
    const box = $('#bkList'); box.replaceChildren();
    if (!list.length) { box.append(el('p', { class: 'muted' }, 'Nincs közelgő foglalás.')); return; }
    const byDay = {};
    list.forEach(b => (byDay[b.date] ||= []).push(b));
    for (const [date, items] of Object.entries(byDay)) {
      box.append(el('div', { class: 'bk-day' }, el('h3', {}, fmtDay(date)), items.map(b => {
        const c = el('button', { class: 'mini danger', type: 'button' }, b.type === 'block' ? 'Feloldás' : 'Lemondás');
        armed(c, c.textContent, async () => { await api('/api/admin/cancel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: b.date, spec: b.spec, id: b.id }) }); bookings = bookings.filter(x => x.id !== b.id); renderBookings(); });
        return el('div', { class: 'bk' + (b.type === 'block' ? ' block' : '') },
          el('span', { class: 't' }, `${b.start}–${b.end}`),
          b.type === 'block'
            ? el('span', { class: 'who' }, el('b', {}, 'Lezárva' + (b.note ? ': ' + b.note : '')), el('small', {}, specName(b.spec)))
            : el('span', { class: 'who' }, el('b', {}, `${b.name} · ${b.phone}`), el('small', {}, `${b.svcName}${b.price ? ' · ' + b.price : ''} · ${specName(b.spec)}${b.email ? ' · ' + b.email : ''}`), b.note ? el('small', {}, 'Megjegyzés: ' + b.note) : null),
          c);
      })));
    }
  }
  $('#refresh').addEventListener('click', loadBookings);

  /* ---------- blocks ---------- */
  $('#blDate').min = new Date().toISOString().slice(0, 10);
  $('#blockForm').addEventListener('submit', async e => {
    e.preventDefault(); const msg = $('#blMsg');
    msg.className = 'status'; msg.textContent = 'Mentés…';
    try {
      const r = await api('/api/admin/block', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spec: $('#blSpec').value, date: $('#blDate').value, dateTo: $('#blDateTo').value, from: $('#blFrom').value, to: $('#blTo').value, note: $('#blNote').value }) });
      msg.className = 'status'; msg.style.color = 'var(--free)';
      const days = new Set(r.created.map(x => x.date)).size;
      msg.textContent = r.created.length ? (days > 1 ? `Lezárva ${days} nap (${fmtDay(r.created[0].date)} – ${fmtDay(r.created[r.created.length - 1].date)}).` : `Lezárva: ${fmtDay($('#blDate').value)}, ${r.created.map(x => `${specName(x.spec)} ${x.start}–${x.end}`).join('; ')}`) : 'Ezekben a napokban amúgy is zárva vagytok.';
      loadBlocks();
    } catch (err) { msg.style.color = ''; msg.className = 'status err'; msg.textContent = err.message; }
  });

  $('#blDate').addEventListener('change', () => { $('#blDateTo').min = $('#blDate').value; if ($('#blDateTo').value && $('#blDateTo').value < $('#blDate').value) $('#blDateTo').value = ''; });
  // beállított zárások nevenként, összevont időszakokkal
  async function loadBlocks() {
    const box = $('#blList'); if (!box) return;
    let blocks = [];
    try { blocks = (await api('/api/admin/blocks')).blocks; } catch (e) { if (e.message !== 'unauthorized') box.replaceChildren(el('p', { class: 'status err' }, e.message)); return; }
    const short = d => { const [, m, dd] = d.split('-'); return `${m}.${dd}.`; };
    const isFull = b => { const s = CFG.specialists.find(x => x.id === b.spec); const h = s?.hours[parseD(b.date).getDay()]; return h && b.start === h[0] && b.end === h[1]; };
    const out = [];
    for (const s of CFG.specialists) {
      const mine = blocks.filter(b => b.spec === s.id);
      // csoportosítás: egyszerre rögzített időszak (group) vagy egyedi nap
      const groups = [];
      for (const b of mine) { const g = b.group && groups.find(x => x.key === b.group); if (g) g.items.push(b); else groups.push({ key: b.group || b.id, items: [b] }); }
      const rows = groups.map(g => {
        const f = g.items[0], l = g.items[g.items.length - 1], n = g.items.length;
        const full = g.items.every(isFull);
        const title = n > 1 ? `${fmtDay(f.date)} – ${fmtDay(l.date)}` : fmtDay(f.date);
        const det = [n > 1 ? `${n} munkanap` : '', full ? 'egész nap' : `${f.start}–${f.end}`, f.note].filter(Boolean).join(' · ');
        const btn = el('button', { class: 'mini', type: 'button' }, 'Visszavonás');
        armed(btn, 'Visszavonás', async () => { await post('/api/admin/unblock', { items: g.items.map(b => ({ date: b.date, spec: b.spec, id: b.id })) }); loadBlocks(); if (!$('#tab-naptar').hidden) loadCal(); });
        return el('div', { class: 'bl-row' }, el('div', {}, el('b', {}, title), el('small', {}, det)), btn);
      });
      out.push(el('div', { class: 'bl-spec' }, el('h3', {}, s.name), rows.length ? el('div', {}, rows) : el('p', { class: 'muted small' }, 'Nincs beállított szabadság vagy zárás.')));
    }
    box.replaceChildren(...out);
  }

  /* ---------- counts ---------- */
  async function loadCounts() {
    try {
      const c = await api('/api/admin/counts');
      const set = (id, n) => { const b = $(id); b.hidden = !n; b.textContent = n; };
      set('#bGb', c.guestbookPending); set('#bFb', c.feedbackUnread);
    } catch {}
  }
  const when = iso => new Date(iso).toLocaleString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const post = (url, body) => api(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  /* ---------- guestbook moderation ---------- */
  let gbAll = [], gbF = 'pending';
  async function loadGb() {
    $('#gbAdmin').replaceChildren(el('p', { class: 'muted' }, 'Betöltés…'));
    try { gbAll = (await api('/api/admin/guestbook')).entries; renderGb(); } catch (e) { if (e.message !== 'unauthorized') $('#gbAdmin').replaceChildren(el('p', { class: 'status err' }, e.message)); }
  }
  function renderGb() {
    const n = st => gbAll.filter(e => e.status === st).length;
    const f = $('#gbFilter'); f.replaceChildren();
    for (const [id, lab] of [['pending', `Jóváhagyásra vár (${n('pending')})`], ['approved', `Megjelenik (${n('approved')})`], ['hidden', `Elrejtve (${n('hidden')})`]])
      f.append(el('button', { class: 'fchip', type: 'button', 'aria-pressed': String(gbF === id), onclick: () => { gbF = id; renderGb(); } }, lab));
    const box = $('#gbAdmin'); box.replaceChildren();
    const list = gbAll.filter(e => e.status === gbF);
    if (!list.length) { box.append(el('p', { class: 'muted' }, gbF === 'pending' ? 'Nincs új bejegyzés.' : 'Nincs ilyen bejegyzés.')); return; }
    for (const e of list) {
      const act = async (action, extra = {}) => { await post('/api/admin/guestbook/' + e.id, { action, ...extra }); await loadGb(); loadCounts(); };
      const pill = { pending: ['p', 'Jóváhagyásra vár'], approved: ['a', 'Megjelenik'], hidden: ['h', 'Elrejtve'] }[e.status];
      const replyTa = el('textarea', { placeholder: 'A stúdió válasza (nem kötelező)', maxlength: '600' }, e.reply || '');
      const saveReply = el('button', { class: 'mini', type: 'button', onclick: async () => { saveReply.textContent = 'Mentés…'; try { await post('/api/admin/guestbook/' + e.id, { action: 'reply', reply: replyTa.value }); saveReply.textContent = 'Mentve'; } catch (err) { saveReply.textContent = 'Válasz mentése'; alertMsg(err.message); } } }, 'Válasz mentése');
      const del = el('button', { class: 'mini danger', type: 'button' }, 'Törlés');
      armed(del, 'Törlés', () => act('delete'));
      box.append(el('div', { class: 'item' + (e.status === 'pending' ? ' pending' : e.status === 'hidden' ? ' hidden-st' : '') },
        el('div', { class: 'item-top' }, el('span', {}, el('span', { class: 'stars-sm' }, '★'.repeat(e.rating) + '☆'.repeat(5 - e.rating)), '  ', el('b', {}, e.name), e.spec ? el('small', {}, ' · ' + specName(e.spec)) : null), el('span', { style: 'display:flex;gap:10px;align-items:center' }, el('small', {}, when(e.createdAt)), el('span', { class: 'pill ' + pill[0] }, pill[1]))),
        el('q', {}, e.text),
        el('div', { class: 'reply' }, replyTa),
        el('div', { class: 'item-actions' },
          e.status !== 'approved' ? el('button', { class: 'btn', type: 'button', style: 'min-height:38px;padding:0 1.2em', onclick: () => act('approve', { reply: replyTa.value }) }, 'Jóváhagyás') : null,
          e.status !== 'hidden' ? el('button', { class: 'mini', type: 'button', onclick: () => act('hide') }, 'Elrejtés') : null,
          saveReply, del)));
    }
  }

  /* ---------- feedback ---------- */
  async function loadFb() {
    $('#fbAdmin').replaceChildren(el('p', { class: 'muted' }, 'Betöltés…'));
    try { renderFb((await api('/api/admin/feedback')).items); } catch (e) { if (e.message !== 'unauthorized') $('#fbAdmin').replaceChildren(el('p', { class: 'status err' }, e.message)); }
  }
  function renderFb(items) {
    const box = $('#fbAdmin'); box.replaceChildren();
    if (!items.length) { box.append(el('p', { class: 'muted' }, 'Még nem érkezett visszajelzés.')); return; }
    for (const x of items) {
      const act = async action => { await post('/api/admin/feedback/' + x.id, { action }); loadFb(); loadCounts(); };
      const del = el('button', { class: 'mini danger', type: 'button' }, 'Törlés');
      armed(del, 'Törlés', () => act('delete'));
      box.append(el('div', { class: 'item' + (x.read ? '' : ' unread') },
        el('div', { class: 'item-top' }, el('span', {}, el('b', {}, x.topic), x.spec ? el('small', {}, ' · ' + specName(x.spec)) : el('small', {}, ' · szakembert nem adott meg')), el('small', {}, when(x.createdAt))),
        el('p', {}, x.text),
        el('small', { class: 'muted' }, [x.name || 'Névtelen', x.contact].filter(Boolean).join(' · ')),
        el('div', { class: 'item-actions' }, el('button', { class: 'mini', type: 'button', onclick: () => act(x.read ? 'unread' : 'read') }, x.read ? 'Olvasatlannak jelöl' : 'Olvasottnak jelöl'), del)));
    }
  }

  /* ---------- közös segédek ---------- */
  const pad2 = n => String(n).padStart(2, '0');
  const ymdL = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addD = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymdL(d); };
  const toMinA = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toTA = m => pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
  const ftA = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft';
  const nf = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const durA = m => m >= 60 ? (m % 60 ? `${Math.floor(m / 60)} ó ${m % 60} p` : `${m / 60} óra`) : `${m} perc`;
  const shortName = id => { const s = CFG.specialists.find(x => x.id === id); return s ? (s.short || s.name) : id; };
  const tip = el('div', { class: 'tip', hidden: true }); document.body.append(tip);
  const showTip = (e, text) => { tip.textContent = text; tip.hidden = false; tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (e.clientY - 34) + 'px'; };

  /* ---------- modal ---------- */
  const modal = $('#modal');
  function openModal(title, ...content) { $('#modalTitle').textContent = title; $('#modalBody').replaceChildren(...content); modal.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModal() { modal.hidden = true; document.body.style.overflow = ''; }
  $('#modalClose').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  /* ---------- látogatók (fejléc-sáv + statisztika) ---------- */
  let visits = null;
  const weekStart = today => { const d = parseD(today); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymdL(d); };
  function periodSums(days, today) {
    const ws = weekStart(today), mo = today.slice(0, 7), yr = today.slice(0, 4);
    const sum = f => days.filter(f).reduce((a, d) => ({ uv: a.uv + d.uv, pv: a.pv + d.pv }), { uv: 0, pv: 0 });
    return { ma: sum(d => d.date === today), het: sum(d => d.date >= ws && d.date <= today), honap: sum(d => d.date.startsWith(mo)), ev: sum(d => d.date.startsWith(yr)), ossz: sum(() => true) };
  }
  async function loadVisits() {
    try { visits = await api('/api/admin/visits'); } catch { return; }
    const p = periodSums(visits.days, visits.today);
    const vs = $('#visitStrip'); vs.hidden = false;
    vs.replaceChildren('Látogatók: ', ...[['ma', p.ma], ['ezen a héten', p.het], ['ebben a hónapban', p.honap], ['összesen', p.ossz]].flatMap(([l, v], i) => [i ? ' · ' : '', `${l}: `, el('b', {}, nf(v.uv))]));
    if (!$('#tab-statisztika').hidden) renderVisits();
  }
  function renderVisits() {
    if (!visits) return;
    const p = periodSums(visits.days, visits.today);
    $('#visitKpis').replaceChildren(...[['Ma', p.ma], ['Ezen a héten', p.het], ['Ebben a hónapban', p.honap], ['Idén', p.ev], ['Összesen', p.ossz]].map(([l, v]) =>
      el('div', { class: 'kpi' }, el('small', {}, l), el('b', {}, nf(v.uv)), el('span', {}, `látogató · ${nf(v.pv)} oldalmegtekintés`))));
    const map = Object.fromEntries(visits.days.map(d => [d.date, d]));
    const series = Array.from({ length: 30 }, (_, i) => { const date = addD(visits.today, i - 29); return { date, uv: map[date]?.uv || 0, pv: map[date]?.pv || 0 }; });
    const max = Math.max(1, ...series.map(s => s.uv));
    const chart = $('#visitChart');
    const bars = el('div', { class: 'spark', role: 'img', 'aria-label': 'Napi látogatók az elmúlt 30 napban' }, series.map(s => {
      const b = el('div', { class: 'bar', style: `height:${(s.uv / max) * 100}%`, tabindex: '0', 'aria-label': `${s.date}: ${s.uv} látogató` });
      const t = `${parseD(s.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}: ${s.uv} látogató, ${s.pv} oldalmegtekintés`;
      b.addEventListener('pointermove', e => showTip(e, t)); b.addEventListener('pointerleave', () => tip.hidden = true);
      return b;
    }));
    const fmtS = d => parseD(d).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
    chart.replaceChildren(bars, el('div', { class: 'spark-axis' }, el('span', {}, fmtS(series[0].date)), el('span', {}, `csúcs: ${max} látogató/nap`), el('span', {}, 'ma')));
  }

  /* ---------- szolgáltatás-statisztika ---------- */
  let statData = null, stPeriod = 'honap', stSpec = 'all';
  async function loadStats() {
    $('#stTable').replaceChildren(el('tbody', {}, el('tr', {}, el('td', {}, 'Betöltés…'))));
    try { statData = await api('/api/admin/stats'); renderStats(); } catch (e) { if (e.message !== 'unauthorized') $('#stTable').replaceChildren(el('tbody', {}, el('tr', {}, el('td', { class: 'status err' }, e.message)))); }
  }
  function renderStats() {
    if (!statData) return;
    const today = statData.today, ws = weekStart(today);
    const P = { het: ['Ez a hét', d => d >= ws], honap: ['Ez a hónap', d => d.startsWith(today.slice(0, 7))], ev: ['Ez az év', d => d.startsWith(today.slice(0, 4))], ossz: ['Összesen', () => true] };
    $('#stPeriod').replaceChildren(...Object.entries(P).map(([k, [l]]) => el('button', { class: 'fchip', type: 'button', 'aria-pressed': String(stPeriod === k), onclick: () => { stPeriod = k; renderStats(); } }, l)));
    $('#stSpec').replaceChildren(...[['all', 'Mindenki'], ...CFG.specialists.map(s => [s.id, s.short || s.name])].map(([k, l]) => el('button', { class: 'fchip', type: 'button', 'aria-pressed': String(stSpec === k), onclick: () => { stSpec = k; renderStats(); } }, l)));
    const ents = statData.entries.filter(e => e.d <= today && P[stPeriod][1](e.d) && (stSpec === 'all' || e.spec === stSpec));
    const rows = {};
    let rev = 0, nItems = 0;
    for (const e of ents) for (const i of e.items) {
      const key = e.spec + '|' + i.svc + (i.svc === 'egyeb' ? '|' + i.name : '');
      const r = rows[key] ||= { name: i.name, cat: i.cat, spec: e.spec, n: 0, rev: 0 };
      r.n++; r.rev += i.p || 0; rev += i.p || 0; nItems++;
    }
    const online = ents.filter(e => e.src === 'online').length;
    $('#stKpis').replaceChildren(...[
      ['Alkalom', nf(ents.length), 'foglalás'],
      ['Szolgáltatás', nf(nItems), 'tétel összesen'],
      ['Online', nf(online), `${ents.length ? Math.round(online / ents.length * 100) : 0}%`],
      ['Telefonos', nf(ents.length - online), `${ents.length ? Math.round((ents.length - online) / ents.length * 100) : 0}%`],
      ['Becsült bevétel', ftA(rev), 'árlista szerint'],
    ].map(([l, v, s]) => el('div', { class: 'kpi' }, el('small', {}, l), el('b', {}, v), el('span', {}, s))));
    const list = Object.values(rows).sort((a, b) => b.n - a.n || b.rev - a.rev);
    const max = Math.max(1, ...list.map(r => r.n));
    const t = $('#stTable');
    if (!list.length) { t.replaceChildren(el('tbody', {}, el('tr', {}, el('td', { class: 'muted' }, 'Ebben az időszakban még nincs megtörtént foglalás.')))); return; }
    t.replaceChildren(
      el('thead', {}, el('tr', {}, el('th', {}, 'Szolgáltatás'), stSpec === 'all' ? el('th', {}, 'Szakember') : null, el('th', {}, 'Darab'), el('th', { class: 'barcell' }, ''), el('th', {}, 'Becsült bevétel'))),
      el('tbody', {}, list.map(r => el('tr', {},
        el('td', {}, r.name, r.cat ? el('div', { class: 'cat' }, r.cat) : null),
        stSpec === 'all' ? el('td', {}, shortName(r.spec)) : null,
        el('td', {}, nf(r.n)),
        el('td', { class: 'barcell' }, el('div', { class: 'hb', style: `width:${r.n / max * 100}%` })),
        el('td', {}, r.rev ? ftA(r.rev) : '–')))),
      el('tfoot', {}, el('tr', {}, el('td', {}, 'Összesen'), stSpec === 'all' ? el('td', {}, '') : null, el('td', {}, nf(nItems)), el('td', {}, ''), el('td', {}, ftA(rev)))));
  }

  /* ---------- naptár ---------- */
  const DAY_S = 7 * 60, DAY_E = 20 * 60, SLOT = 30, RH = 44;
  let calDate = ymdL(new Date()), calSpec = 'all', calBookings = [], calG = {};
  const yPos = m => (m - DAY_S) / SLOT * RH;
  async function loadCal() {
    $('#calDate').value = calDate;
    const d = parseD(calDate), isToday = calDate === ymdL(new Date());
    $('#calTitle').textContent = (isToday ? 'Ma, ' : '') + d.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long' });
    $('#calSpecs').replaceChildren(...[['all', 'Mindenki'], ...CFG.specialists.map(s => [s.id, s.short || s.name])].map(([k, l]) => el('button', { class: 'fchip', type: 'button', 'aria-pressed': String(calSpec === k), onclick: () => { calSpec = k; renderCal(); } }, l)));
    renderCal();
    calG = {};
    try { calBookings = (await api(`/api/admin/bookings?from=${calDate}&to=${calDate}`)).bookings; renderCal(); api(`/api/admin/gbusy?date=${calDate}`).then(r => { calG = r.busy || {}; renderCal(); }).catch(() => {}); }
    catch (e) { if (e.message !== 'unauthorized') alertMsg(e.message); }
  }
  // „Nap zárása”: az utolsó foglalás (vagy a mostani idő) után a nap hátralévő részét lezárja
  async function endDay(s, hrs) {
    const close = toMinA(hrs[1]);
    let from = toMinA(hrs[0]);
    if (calDate === ymdL(new Date())) { const n = new Date(); from = Math.max(from, Math.ceil((n.getHours() * 60 + n.getMinutes()) / 15) * 15); }
    for (const b of calBookings) if (b.spec === s.id && b.date === calDate) from = Math.max(from, toMinA(b.end));
    if (from >= close) return alertMsg(`${s.name}: erre a napra már nincs szabad, lezárható idő.`);
    if (!window.confirm(`${s.name} – ${fmtDay(calDate)}\n\nLezárod a napot ${toTA(from)}–${hrs[1]} között? Erre az időre ezután nem lehet foglalni. (A Szabadság, zárás fülön visszavonható.)`)) return;
    try { await post('/api/admin/block', { spec: s.id, date: calDate, from: toTA(from), to: hrs[1], note: 'Nap vége' }); loadCal(); }
    catch (e) { alertMsg(e.message); }
  }
  function renderCal() {
    document.querySelectorAll('#calSpecs .fchip').forEach((b, i) => b.setAttribute('aria-pressed', String((i === 0 ? 'all' : CFG.specialists[i - 1].id) === calSpec)));
    const specs = calSpec === 'all' ? CFG.specialists : CFG.specialists.filter(s => s.id === calSpec);
    const g = $('#calGrid'); g.style.setProperty('--cols', specs.length); g.style.setProperty('--rh', RH + 'px');
    const H = yPos(DAY_E);
    const kids = [el('div', { class: 'cal-colhead', style: 'border-left:0' }, '')];
    const todayL = ymdL(new Date());
    for (const s of specs) {
      const hrs = s.hours[parseD(calDate).getDay()];
      kids.push(el('div', { class: 'cal-colhead' }, el('span', {}, s.short || s.name),
        hrs && calDate >= todayL && s.booking !== 'messenger' ? el('button', { class: 'day-end', type: 'button', title: 'A nap hátralévő részére már nem lehet foglalni', onclick: () => endDay(s, hrs) }, 'Nap zárása') : null));
    }
    const times = el('div', { class: 'cal-times', style: `height:${H}px` });
    for (let m = DAY_S + 60; m < DAY_E; m += 60) times.append(el('span', { style: `top:${yPos(m)}px` }, toTA(m)));
    kids.push(times);
    const wd = parseD(calDate).getDay();
    const nowM = new Date().getHours() * 60 + new Date().getMinutes();
    for (const s of specs) {
      const col = el('div', { class: 'cal-col', style: `height:${H}px`, 'data-spec': s.id });
      const hrs = s.hours[wd];
      if (!hrs) col.append(el('div', { class: 'cal-off', style: `top:0;height:${H}px` }));
      else {
        col.append(el('div', { class: 'cal-off', style: `top:0;height:${Math.max(0, yPos(toMinA(hrs[0])))}px` }));
        col.append(el('div', { class: 'cal-off', style: `top:${yPos(toMinA(hrs[1]))}px;height:${Math.max(0, H - yPos(toMinA(hrs[1])))}px` }));
      }
      if (calDate === ymdL(new Date()) && nowM > DAY_S && nowM < DAY_E) col.append(el('div', { class: 'cal-now', style: `top:${yPos(nowM)}px` }));
      const own = calBookings.filter(x => x.spec === s.id);
      for (const g of calG[s.id] || []) {
        if (own.some(b => b.start === g.start && b.dur === g.dur)) continue; // a weboldalról felírt esemény
        const top = yPos(Math.max(DAY_S, toMinA(g.start))), h = Math.max(22, yPos(Math.min(DAY_E, toMinA(g.start) + g.dur)) - top - 2);
        if (toMinA(g.start) + g.dur <= DAY_S || toMinA(g.start) >= DAY_E) continue;
        col.append(el('button', { type: 'button', class: 'cal-ev gcal', style: `top:${top}px;height:${h}px`, onclick: e => { e.stopPropagation(); openModal('Google Naptár', el('p', {}, `${s.name} Google Naptárában ebben az időszakban (${g.start}–${toTA(toMinA(g.start) + g.dur)}) foglalt bejegyzés van. Ezt a Google Naptárban tudod módosítani; ide online foglalás nem érkezhet.`)); } },
          el('b', {}, `${g.start}–${toTA(toMinA(g.start) + g.dur)} Google Naptár`), el('small', {}, 'foglalt')));
      }
      for (const b of own) {
        const kind = b.type === 'block' ? 'block' : (b.source === 'telefon' ? 'telefon' : 'online');
        const top = yPos(Math.max(DAY_S, toMinA(b.start))), h = Math.max(22, yPos(Math.min(DAY_E, toMinA(b.end))) - top - 2);
        // hatóidő-sáv (pl. festés közben): ide férfi hajvágás foglalható; az ott lévő foglalás jobb oldalt jelenik meg
        // a hatóidős (pl. festés) foglalás csak a bal fél oszlopot foglalja; a jobb félen a hatóidő-sávra koppintva új foglalás rögzíthető
        const pauses = [];
        for (const [a, e] of b.soft || []) col.append(el('div', { class: 'cal-pause', style: `top:${yPos(a)}px;height:${yPos(e) - yPos(a) - 2}px`, title: `Hatóidő ${toTA(a)}–${toTA(e)}: koppints új foglaláshoz` }, el('b', {}, '+ Hatóidő'), el('small', {}, `${toTA(a)}–${toTA(e)}`)));
        col.append(el('button', { type: 'button', class: 'cal-ev ' + kind + ((b.soft || []).length ? ' has-pause' : '') + (b.fill && own.some(o => o !== b && o.soft && toMinA(o.start) < toMinA(b.end) && toMinA(b.start) < toMinA(o.end)) ? ' in-pause' : ''), style: `top:${top}px;height:${h}px`, onclick: e => { e.stopPropagation(); showBooking(b); } },
          el('b', {}, `${b.start}–${b.end} ${b.type === 'block' ? 'Lezárva' : b.name}`), el('small', {}, b.type === 'block' ? (b.note || '') : b.svcName), ...pauses));
      }
      col.addEventListener('click', e => {
        const r = col.getBoundingClientRect();
        const m = DAY_S + Math.floor((e.clientY - r.top) / RH) * SLOT;
        newBooking({ spec: s.id, date: calDate, start: toTA(Math.min(DAY_E - SLOT, Math.max(DAY_S, m))) });
      });
      kids.push(col);
    }
    g.replaceChildren(...kids);
  }
  function showBooking(b) {
    const src = b.type === 'block' ? 'Lezárt időszak' : b.source === 'telefon' ? 'Telefonos foglalás' : 'Online foglalás';
    const del = el('button', { class: 'mini danger', type: 'button' }, b.type === 'block' ? 'Feloldás' : 'Lemondás');
    armed(del, del.textContent, async () => { await post('/api/admin/cancel', { date: b.date, spec: b.spec, id: b.id }); closeModal(); loadCal(); });
    const rows = [['Időpont', `${fmtDay(b.date)}, ${b.start}–${b.end}`], ['Szakember', specName(b.spec)], ['Típus', src]];
    if (b.type !== 'block') {
      rows.push(['Vendég', b.name]);
      if (b.phone) rows.push(['Telefon', el('a', { href: 'tel:' + b.phone.replace(/\s/g, ''), class: 'tel' }, b.phone)]);
      if (b.email) rows.push(['E-mail', b.email]);
      rows.push(['Szolgáltatás', b.svcName]);
      if (b.price) rows.push(['Ár', b.price]);
    }
    if (b.note) rows.push(['Megjegyzés', b.note]);
    openModal(b.type === 'block' ? 'Lezárt időszak' : b.name,
      el('dl', { class: 'm-info' }, rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])),
      el('div', { class: 'item-actions' }, del, el('button', { class: 'mini', type: 'button', onclick: closeModal }, 'Bezárás')));
  }
  function newBooking(pre) {
    const state = { spec: pre.spec || CFG.specialists[0].id, items: {}, durTouched: false, dur: 30, cat: null };
    const specSel = el('select', { id: 'mSpec' }, CFG.specialists.map(s => el('option', { value: s.id, selected: s.id === state.spec }, s.name)));
    const dateIn = el('input', { type: 'date', id: 'mDate', value: pre.date, required: true });
    const timeIn = el('input', { type: 'time', id: 'mTime', value: pre.start, step: '900', required: true });
    const svcBox = el('div', {}), durB = el('b', {}), extra = el('input', { id: 'mExtra', maxlength: '120', placeholder: 'pl. konzultáció, egyedi kérés' });
    const nameIn = el('input', { id: 'mName', maxlength: '80', autocomplete: 'off', required: true }), phoneIn = el('input', { id: 'mPhone', type: 'tel', maxlength: '30', autocomplete: 'off' });
    const noteIn = el('input', { id: 'mNote', maxlength: '500' });
    const msg = el('p', { class: 'status', role: 'status' });
    const S = () => CFG.specialists.find(s => s.id === state.spec);
    const autoDur = () => Object.keys(state.items).reduce((a, id) => a + (S().services.find(v => v.id === id)?.dur || 0), 0) || 30;
    const paintDur = () => { if (!state.durTouched) state.dur = autoDur(); durB.textContent = durA(state.dur) + ` (${timeIn.value || '--:--'}–${timeIn.value ? toTA(toMinA(timeIn.value) + state.dur) : '--:--'})`; };
    const renderSvcs = () => {
      const sp = S(); const box = el('div', { class: 'm-svcs' });
      const groups = sp.categories ? sp.categories.flatMap(c => c.groups.filter(g => g.bookable !== false).map(g => [c.hideName ? g.name : c.groups.length > 1 ? `${c.name} – ${g.name}` : c.name, g.services])) : [[sp.role, sp.services]];
      for (const [gn, list] of groups) {
        box.append(el('p', { class: 'm-g' }, gn));
        for (const v of list) {
          const chk = el('input', { type: 'checkbox', checked: v.id in state.items });
          const lenSel = v.prices ? el('select', { 'aria-label': sp.lengths ? 'Méret' : 'Hajhossz' }, el('option', { value: '' }, (sp.lengths ? 'Méret' : 'Hajhossz') + ' (nem kötelező)'), (sp.lengths || CFG.lengths).map((L, i) => v.prices[i] == null ? null : el('option', { value: L.id, selected: state.items[v.id] === L.id }, `${L.name} · ${ftA(v.prices[i])}`))) : null;
          if (lenSel) { lenSel.hidden = !(v.id in state.items); lenSel.addEventListener('change', () => { state.items[v.id] = lenSel.value || null; }); }
          chk.addEventListener('change', () => { if (chk.checked) state.items[v.id] = null; else delete state.items[v.id]; if (lenSel) lenSel.hidden = !chk.checked; paintDur(); });
          box.append(el('label', { class: 'm-svc' }, chk, el('span', {}, v.name), el('small', {}, durA(v.dur)), lenSel));
        }
      }
      svcBox.replaceChildren(box);
    };
    specSel.addEventListener('change', () => { state.spec = specSel.value; state.items = {}; renderSvcs(); paintDur(); });
    timeIn.addEventListener('input', paintDur);
    const step = d => { state.durTouched = true; state.dur = Math.max(15, Math.min(720, state.dur + d)); paintDur(); };
    const save = async force => {
      msg.className = 'status err';
      if (nameIn.value.trim().length < 2) { msg.textContent = 'Add meg a vendég nevét.'; nameIn.focus(); return; }
      if (!Object.keys(state.items).length && !extra.value.trim()) { msg.textContent = 'Jelölj be legalább egy szolgáltatást, vagy írd be, mire jön a vendég.'; return; }
      msg.className = 'status'; msg.textContent = 'Mentés…';
      try {
        await post('/api/admin/manual-book', { spec: state.spec, date: dateIn.value, start: timeIn.value, dur: state.dur, force,
          items: Object.entries(state.items).map(([svc, length]) => ({ svc, length })), extra: extra.value, name: nameIn.value, phone: phoneIn.value, note: noteIn.value });
        closeModal(); calDate = dateIn.value; loadCal();
      } catch (e) {
        msg.className = 'status err'; msg.textContent = e.message;
        if (/foglalta|ütköz/i.test(e.message)) msg.append(' ', el('button', { class: 'mini', type: 'button', onclick: () => save(true) }, 'Mentés mégis (ütközéssel)'));
      }
    };
    renderSvcs(); paintDur();
    openModal('Új foglalás (telefonos)',
      el('div', { class: 'row2' }, el('label', { class: 'field' }, el('span', {}, 'Szakember'), specSel), el('label', { class: 'field' }, el('span', {}, 'Vendég neve'), nameIn)),
      el('div', { class: 'row2' }, el('label', { class: 'field' }, el('span', {}, 'Nap'), dateIn), el('label', { class: 'field' }, el('span', {}, 'Kezdés'), timeIn)),
      el('div', { class: 'field' }, el('span', {}, 'Szolgáltatások'), svcBox),
      el('label', { class: 'field' }, el('span', {}, 'Egyéb (ha nincs a listában)'), extra),
      el('div', { class: 'field' }, el('span', {}, 'Időtartam'), el('div', { class: 'dur-ctl' }, el('button', { class: 'mini nav-btn', type: 'button', onclick: () => step(-15), 'aria-label': '15 perccel rövidebb' }, '−'), durB, el('button', { class: 'mini nav-btn', type: 'button', onclick: () => step(15), 'aria-label': '15 perccel hosszabb' }, '+'))),
      el('div', { class: 'row2' }, el('label', { class: 'field' }, el('span', {}, 'Telefonszám (nem kötelező)'), phoneIn), el('label', { class: 'field' }, el('span', {}, 'Megjegyzés'), noteIn)),
      el('div', { class: 'item-actions' }, el('button', { class: 'btn', type: 'button', onclick: () => save(false) }, 'Foglalás mentése'), msg));
    setTimeout(() => nameIn.focus(), 50);
  }
  // Google Naptár kapcsolat-ellenőrzés
  $('#gcalTest')?.addEventListener('click', async () => {
    const out = $('#gcalOut'), btn = $('#gcalTest');
    btn.disabled = true; out.replaceChildren(el('p', { class: 'muted' }, 'Ellenőrzés folyamatban…'));
    const row = (ok, title, msg) => el('div', { class: 'gc-row ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'na') }, el('b', {}, (ok === true ? '✓ ' : ok === false ? '✗ ' : '– ') + title), el('span', {}, msg));
    try {
      const r = await api('/api/admin/gcal-test');
      const rows = [row(r.account.ok, 'Szolgáltatásfiók kulcs', r.account.ok ? `Rendben (${r.account.email})` : r.account.msg)];
      for (const s of r.specs || []) rows.push(row(s.ok, `${specName(s.spec)} (${s.env}${s.calendar ? ' = ' + s.calendar : ''})`, s.msg));
      out.replaceChildren(...rows);
      $('#gcalSync').hidden = !(r.specs || []).some(s => s.ok);
    } catch (e) { out.replaceChildren(row(false, 'Hiba', e.message)); }
    btn.disabled = false;
  });
  $('#mailTest')?.addEventListener('click', async () => {
    const out = $('#mailOut'), btn = $('#mailTest');
    btn.disabled = true; out.replaceChildren(el('p', { class: 'muted' }, 'Küldés folyamatban…'));
    const row = (ok, title, msg) => el('div', { class: 'gc-row ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'na') }, el('b', {}, (ok === true ? '✓ ' : ok === false ? '✗ ' : '– ') + title), el('span', {}, msg));
    try {
      const r = await post('/api/admin/mail-test', {});
      out.replaceChildren(...(r.results ? r.results.map(x => row(x.ok, specName(x.spec), x.msg)) : [row(false, 'Beállítás', r.msg)]));
    } catch (e) { out.replaceChildren(row(false, 'Hiba', e.message)); }
    btn.disabled = false;
  });
  $('#gcalSync')?.addEventListener('click', async () => {
    const btn = $('#gcalSync'); btn.disabled = true;
    try { const r = await post('/api/admin/gcal-sync', {}); alertMsg(`${r.count} foglalás felírva a Google Naptárba.`); }
    catch (e) { alertMsg(e.message); }
    btn.disabled = false;
  });
  $('#calPrevDay').addEventListener('click', () => { calDate = addD(calDate, -1); loadCal(); });
  $('#calNextDay').addEventListener('click', () => { calDate = addD(calDate, 1); loadCal(); });
  $('#calToday').addEventListener('click', () => { calDate = ymdL(new Date()); loadCal(); });
  $('#calDate').addEventListener('change', e => { if (e.target.value) { calDate = e.target.value; loadCal(); } });
  $('#calNew').addEventListener('click', () => newBooking({ spec: calSpec === 'all' ? CFG.specialists[0].id : calSpec, date: calDate, start: '10:00' }));

  /* ---------- heti munkarend ---------- */
  const DAYS = [[1, 'Hétfő'], [2, 'Kedd'], [3, 'Szerda'], [4, 'Csütörtök'], [5, 'Péntek'], [6, 'Szombat'], [0, 'Vasárnap']];
  let sched = null, schedSpec = null, schedEdit = null;
  async function loadSched() {
    try { sched = (await api('/api/admin/schedule')).schedule; } catch (e) { if (e.message !== 'unauthorized') $('#schedMsg').textContent = e.message; return; }
    if (!schedSpec) schedSpec = CFG.specialists[0].id;
    pickSched(schedSpec);
  }
  function pickSched(id) {
    schedSpec = id;
    schedEdit = JSON.parse(JSON.stringify(sched[id].hours || {}));
    $('#schedSpecs').replaceChildren(...CFG.specialists.map(s => el('button', { class: 'fchip', type: 'button', 'aria-pressed': String(s.id === id), onclick: () => pickSched(s.id) }, s.short || s.name)));
    $('#schedMsg').textContent = '';
    renderSched();
  }
  function renderSched() {
    const def = sched[schedSpec].defaults;
    $('#schedRows').replaceChildren(...DAYS.map(([d, name]) => {
      const on = !!schedEdit[d];
      const h = schedEdit[d] || def[d] || ['09:00', '17:00'];
      const chk = el('input', { type: 'checkbox', checked: on, 'aria-label': name + ' munkanap' });
      const from = el('input', { type: 'time', value: h[0], step: '1800', 'aria-label': name + ' kezdés' });
      const to = el('input', { type: 'time', value: h[1], step: '1800', 'aria-label': name + ' befejezés' });
      const label = el('span', {}, on ? 'Dolgozik' : 'Szabadnap');
      chk.addEventListener('change', () => { schedEdit[d] = chk.checked ? [from.value, to.value] : null; if (!chk.checked) delete schedEdit[d]; renderSched(); });
      const upd = () => { if (chk.checked) schedEdit[d] = [from.value, to.value]; };
      from.addEventListener('change', upd); to.addEventListener('change', upd);
      return el('div', { class: 'sched-row' + (on ? '' : ' off') }, el('b', {}, name), el('label', { class: 'sw' }, chk, el('i'), label),
        el('div', { class: 'sched-times' }, from, el('span', { class: 'muted' }, '–'), to));
    }));
  }
  $('#schedSave').addEventListener('click', async () => {
    const msg = $('#schedMsg'); msg.className = 'status'; msg.style.color = ''; msg.textContent = 'Mentés…';
    try {
      const r = await post('/api/admin/schedule', { spec: schedSpec, hours: schedEdit });
      sched[schedSpec].hours = JSON.parse(JSON.stringify(schedEdit));
      const sp = CFG.specialists.find(s => s.id === schedSpec); if (sp) sp.hours = JSON.parse(JSON.stringify(schedEdit));
      msg.style.color = 'var(--free)';
      msg.textContent = 'Elmentve. ' + (r.conflicts.length ? `Figyelem: ezeken a mostantól szabadnapokon már van foglalás: ${r.conflicts.map(fmtDay).join(', ')}. Ezeket egyeztesd a vendéggel.` : 'Az online foglalás már az új munkarend szerint működik.');
    } catch (e) { msg.className = 'status err'; msg.textContent = e.message; }
  });
  $('#schedReset').addEventListener('click', () => { schedEdit = JSON.parse(JSON.stringify(sched[schedSpec].defaults)); renderSched(); $('#schedMsg').textContent = 'Visszaállítva az alapértelmezésre – a mentéshez kattints a „Munkarend mentése” gombra.'; });

  if (PW) api('/api/admin/login', { method: 'POST' }).then(enter).catch(() => {});
})();
