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
  const TABS = ['galeria', 'foglalasok', 'zaras', 'vendegkonyv', 'visszajelzes'];
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
    TABS.forEach(t => $('#tab-' + t).hidden = true);
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
    showTab(location.hash.slice(1) || 'galeria');
  }
  function showTab(t) {
    if (!TABS.includes(t)) t = 'galeria';
    document.querySelectorAll('.tab[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    TABS.forEach(x => $('#tab-' + x).hidden = x !== t);
    history.replaceState(null, '', '#' + t);
    if (t === 'galeria') loadImages();
    if (t === 'foglalasok') loadBookings();
    if (t === 'vendegkonyv') loadGb();
    if (t === 'visszajelzes') loadFb();
    loadCounts();
  }
  document.querySelectorAll('.tab[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

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
            : el('span', { class: 'who' }, el('b', {}, `${b.name} · ${b.phone}`), el('small', {}, `${b.svcName} · ${specName(b.spec)}${b.email ? ' · ' + b.email : ''}`), b.note ? el('small', {}, 'Megjegyzés: ' + b.note) : null),
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
      const r = await api('/api/admin/block', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spec: $('#blSpec').value, date: $('#blDate').value, from: $('#blFrom').value, to: $('#blTo').value, note: $('#blNote').value }) });
      msg.className = 'status'; msg.style.color = 'var(--free)';
      msg.textContent = r.created.length ? `Lezárva: ${fmtDay($('#blDate').value)}, ${r.created.map(x => `${specName(x.spec)} ${x.start}–${x.end}`).join('; ')}` : 'Ezen a napon amúgy is zárva vagytok.';
    } catch (err) { msg.style.color = ''; msg.className = 'status err'; msg.textContent = err.message; }
  });

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
        el('div', { class: 'item-top' }, el('span', {}, el('b', {}, x.topic), x.spec ? el('small', {}, ' · ' + specName(x.spec)) : el('small', {}, ' · egész stúdió')), el('small', {}, when(x.createdAt))),
        el('p', {}, x.text),
        el('small', { class: 'muted' }, [x.name || 'Névtelen', x.contact].filter(Boolean).join(' · ')),
        el('div', { class: 'item-actions' }, el('button', { class: 'mini', type: 'button', onclick: () => act(x.read ? 'unread' : 'read') }, x.read ? 'Olvasatlannak jelöl' : 'Olvasottnak jelöl'), del)));
    }
  }

  if (PW) api('/api/admin/login', { method: 'POST' }).then(enter).catch(() => {});
})();
