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
  const icon = (name, cls = 'ico') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true'); const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#i-' + name); s.append(u); return s; };
  const pad = n => String(n).padStart(2, '0');
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toT = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const fmtDay = s => parse(s).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long' });
  const durTxt = m => m >= 60 ? (m % 60 ? `${Math.floor(m / 60)} óra ${m % 60} perc` : `${m / 60} óra`) : `${m} perc`;
  const api = async (path, opts) => {
    const r = await fetch(path, opts);
    let data = null; try { data = await r.json(); } catch {}
    if (!r.ok) { const e = new Error(data?.message || 'Hiba történt.'); e.code = data?.error; throw e; }
    return data;
  };
  $('#year').textContent = new Date().getFullYear();

  /* ---------- header ---------- */
  const head = $('#head');
  const onScroll = () => head.classList.toggle('solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const nav = $('#nav'), burger = $('#burger');
  burger.addEventListener('click', () => { const o = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', o); });
  nav.addEventListener('click', e => { if (e.target.closest('a')) { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });

  /* ---------- reveal ---------- */
  const rv = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    rv.forEach(x => io.observe(x));
    setTimeout(() => rv.forEach(x => x.classList.add('in')), 2500); // safety net
  } else rv.forEach(x => x.classList.add('in'));

  let CFG = null;
  const specById = id => CFG.specialists.find(s => s.id === id);

  /* ---------- team ---------- */
  function renderTeam() {
    const box = $('#team'); box.replaceChildren();
    for (const s of CFG.specialists) {
      box.append(el('article', { class: 'member', id: 'sz-' + s.id },
        el('div', { class: 'member-top' }, el('div', { class: 'member-ico' }, icon(s.icon)),
          el('div', {}, el('h3', {}, s.name), el('p', { class: 'role' }, s.role))),
        el('ul', { class: 'svc-list' }, s.services.map(v => el('li', {}, v.name, el('span', {}, durTxt(v.dur))))),
        el('div', { class: 'member-foot' },
          el('a', { class: 'tel', href: 'tel:' + s.phone.replace(/\s/g, '') }, icon('phone'), s.phone),
          el('a', { class: 'textlink', href: '/foglalas/?szakember=' + s.id }, 'Időpontot foglalok', icon('arrow-right')))));
    }
  }

  /* ---------- gallery ---------- */
  let images = [], galFilter = 'all', lbList = [], lbIdx = 0;
  function renderGalFilter() {
    const box = $('#galFilter'); box.replaceChildren();
    const opts = [['all', 'Összes'], ...CFG.specialists.map(s => [s.id, s.role])];
    for (const [id, lab] of opts) box.append(el('button', { class: 'chip', 'aria-pressed': String(galFilter === id), onclick: () => { galFilter = id; renderGalFilter(); renderGallery(); } }, lab));
  }
  function renderGallery() {
    const box = $('#gal'); box.replaceChildren();
    const list = images.filter(i => galFilter === 'all' || i.spec === galFilter);
    lbList = list;
    if (!list.length) {
      box.append(el('div', { class: 'gal-empty' }, icon('image'), el('h3', {}, 'Hamarosan'),
        el('p', {}, galFilter === 'all' ? 'Galériánk most készül. Addig is nézz be hozzánk az Instagramon.' : 'Ehhez a szakterülethez hamarosan töltünk fel képeket.'),
        el('a', { class: 'btn line', href: 'https://www.instagram.com/byp.studio11/', target: '_blank', rel: 'noopener' }, icon('instagram'), 'Instagram')));
      return;
    }
    const g = el('div', { class: 'gal' });
    list.forEach((it, i) => {
      const s = it.spec && specById(it.spec);
      const alt = it.caption || (s ? s.role + ' – BYP Stúdió' : 'BYP Stúdió munka');
      const img = el('img', { src: '/api/img/' + it.id, alt, loading: 'lazy', decoding: 'async', width: it.w || null, height: it.h || null });
      g.append(el('figure', {}, el('button', { 'aria-label': 'Nagyítás: ' + alt, onclick: () => openLb(i) }, img),
        (it.caption || s) ? el('figcaption', {}, [it.caption, s && s.role].filter(Boolean).join(' · ')) : null));
    });
    box.append(g);
  }
  const lb = $('#lb');
  function openLb(i) { lbIdx = i; showLb(); lb.hidden = false; document.body.style.overflow = 'hidden'; $('#lbClose').focus(); }
  function showLb() { const it = lbList[lbIdx]; const s = it.spec && specById(it.spec); $('#lbImg').src = '/api/img/' + it.id; $('#lbImg').alt = it.caption || ''; $('#lbCap').textContent = [it.caption, s && s.name].filter(Boolean).join(' · '); }
  function closeLb() { lb.hidden = true; document.body.style.overflow = ''; }
  const step = d => { lbIdx = (lbIdx + d + lbList.length) % lbList.length; showLb(); };
  if (lb) {
  $('#lbClose').onclick = closeLb; $('#lbPrev').onclick = () => step(-1); $('#lbNext').onclick = () => step(1);
  lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
  }
  addEventListener('keydown', e => { if (!lb || lb.hidden) return; if (e.key === 'Escape') closeLb(); if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); });

  /* ---------- booking ---------- */
  const st = { spec: null, svc: null, date: null, time: null, month: null };
  let avail = null; // {today, nowMinutes, until, days}
  let availFor = null;

  function stepInfo() {
    const S = st.spec && specById(st.spec), V = S && S.services.find(v => v.id === st.svc);
    const vals = [S ? (S.short || S.name) : '', V ? V.name : '', st.time ? `${parse(st.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })} ${st.time}` : '', ''];
    const cur = !S ? 1 : !V ? 2 : !st.time ? 3 : 4;
    document.querySelectorAll('#stepList li').forEach((li, i) => {
      li.classList.toggle('done', i + 1 < cur); li.classList.toggle('cur', i + 1 === cur);
      li.lastElementChild.textContent = vals[i];
    });
  }
  function selectSpec(id) {
    st.spec = id; st.svc = null; st.time = null;
    renderBooking(); loadAvail();
  }
  async function loadAvail() {
    if (!st.spec) return;
    const want = st.spec; availFor = want; avail = null; renderCal();
    try { const a = await api('/api/availability?spec=' + encodeURIComponent(want)); if (availFor === want) { avail = a; renderCal(); } }
    catch { if (availFor === want) { $('#slots').replaceChildren(el('p', { class: 'status err', style: 'grid-column:1/-1' }, 'A naptár betöltése nem sikerült. Frissítsd az oldalt, vagy hívd a szakembert.')); } }
  }
  function slotsFor(date) {
    const S = specById(st.spec), V = S.services.find(v => v.id === st.svc);
    const hours = S.hours[parse(date).getDay()];
    if (!hours || !avail) return [];
    const items = avail.days[date] || [];
    const out = [], o = toMin(hours[0]), c = toMin(hours[1]);
    for (let m = o; m + V.dur <= c; m += CFG.salon.stepMinutes) {
      const busy = items.some(it => { const a = toMin(it.start); return m < a + it.dur && a < m + V.dur; });
      const past = date === avail.today && m < avail.nowMinutes + CFG.salon.minLeadMinutes;
      out.push({ t: toT(m), free: !busy && !past });
    }
    return out;
  }
  function renderBooking() {
    const ps = $('#pickSpec'); ps.replaceChildren();
    for (const s of CFG.specialists) ps.append(el('button', { type: 'button', class: 'opt', 'aria-pressed': String(st.spec === s.id), onclick: () => selectSpec(s.id) }, icon(s.icon), el('b', {}, s.short || s.name), el('small', {}, s.role)));
    const S = st.spec && specById(st.spec);
    $('#blkSvc').hidden = !S;
    const pv = $('#pickSvc'); pv.replaceChildren();
    if (S) for (const v of S.services) pv.append(el('button', { type: 'button', class: 'opt', 'aria-pressed': String(st.svc === v.id), onclick: () => { st.svc = v.id; st.time = null; renderBooking(); renderCal(); setTimeout(() => $('#blkCal').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30); } }, el('b', {}, v.name), el('span', {}, durTxt(v.dur))));
    $('#blkCal').hidden = !(S && st.svc);
    renderForm(); stepInfo();
  }
  function renderCal() {
    if (!st.spec || !st.svc) return;
    const today = avail ? avail.today : ymd(new Date());
    const until = avail ? avail.until : ymd(new Date(Date.now() + CFG.salon.daysAhead * 864e5));
    if (!st.month) st.month = today.slice(0, 7);
    const [y, m] = st.month.split('-').map(Number);
    $('#calMonth').textContent = new Date(y, m - 1, 1).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' });
    $('#calPrev').disabled = st.month <= today.slice(0, 7);
    $('#calNext').disabled = st.month >= until.slice(0, 7);
    const box = $('#days'); box.replaceChildren();
    ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].forEach(d => box.append(el('span', { class: 'dow' }, d)));
    const first = new Date(y, m - 1, 1), lead = (first.getDay() + 6) % 7, nDays = new Date(y, m, 0).getDate();
    for (let i = 0; i < lead; i++) box.append(el('span'));
    let firstFree = null;
    for (let d = 1; d <= nDays; d++) {
      const date = `${st.month}-${pad(d)}`;
      const S = specById(st.spec);
      const open = !!S.hours[parse(date).getDay()];
      const inRange = date >= today && date <= until;
      let free = 0;
      if (open && inRange && avail) free = slotsFor(date).filter(x => x.free).length;
      const enabled = open && inRange && !!avail;
      if (enabled && free && !firstFree) firstFree = date;
      box.append(el('button', { type: 'button', class: 'day' + (date === today ? ' today' : '') + (enabled && !free ? ' full' : ''), disabled: !enabled, 'aria-pressed': String(st.date === date), 'aria-label': fmtDay(date) + (enabled ? (free ? `, ${free} szabad időpont` : ', betelt') : ''), onclick: () => { st.date = date; st.time = null; renderCal(); renderForm(); stepInfo(); } },
        el('span', { class: 'd' }, d), enabled ? el('span', { class: 'c' }, free ? `${free} szabad` : 'betelt') : null));
    }
    if (avail && (!st.date || st.date.slice(0, 7) !== st.month || st.date < today)) {
      if (firstFree) { st.date = firstFree; return renderCal(); }
    }
    renderSlots();
  }
  function renderSlots() {
    const box = $('#slots'); box.replaceChildren();
    const S = specById(st.spec);
    if (!avail) { box.append(el('p', { class: 'muted', style: 'grid-column:1/-1' }, 'Szabad időpontok betöltése…')); $('#dayHours').textContent = ''; return; }
    if (!st.date || st.date.slice(0, 7) !== st.month) { box.append(el('p', { class: 'muted', style: 'grid-column:1/-1' }, 'Válassz egy napot a naptárban.')); $('#dayHours').textContent = ''; return; }
    const h = S.hours[parse(st.date).getDay()];
    $('#dayHours').textContent = h ? `${fmtDay(st.date)}: ${h[0]}–${h[1]}` : '';
    const sl = slotsFor(st.date);
    if (!sl.some(x => x.free)) box.append(el('p', { class: 'muted', style: 'grid-column:1/-1' }, 'Erre a napra már nincs szabad időpont. Válassz másik napot.'));
    for (const x of sl) box.append(el('button', { type: 'button', class: 'slot' + (x.free ? '' : ' taken'), disabled: !x.free, 'aria-pressed': String(st.time === x.t), 'aria-label': x.t + (x.free ? '' : ', foglalt'), onclick: () => { st.time = x.t; renderSlots(); renderForm(); stepInfo(); setTimeout(() => $('#blkForm').scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); } }, x.t));
  }
  function renderForm() {
    const S = st.spec && specById(st.spec), V = S && S.services.find(v => v.id === st.svc);
    const show = !!(V && st.date && st.time);
    $('#blkForm').hidden = !show;
    if (!show) return;
    $('#summary').replaceChildren(
      el('div', {}, el('p', { class: 'when' }, `${fmtDay(st.date)}, ${st.time}–${toT(toMin(st.time) + V.dur)}`), el('p', { class: 'muted' }, `${V.name} · ${S.name}`)),
      el('button', { type: 'button', class: 'textlink', style: 'margin-left:auto', onclick: () => { st.time = null; renderSlots(); renderForm(); stepInfo(); $('#blkCal').scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 'Másik időpont'));
  }
  if ($('#panel')) {
  $('#calPrev').onclick = () => { const [y, m] = st.month.split('-').map(Number); const d = new Date(y, m - 2, 1); st.month = ymd(d).slice(0, 7); st.time = null; renderCal(); renderForm(); stepInfo(); };
  $('#calNext').onclick = () => { const [y, m] = st.month.split('-').map(Number); const d = new Date(y, m, 1); st.month = ymd(d).slice(0, 7); st.time = null; renderCal(); renderForm(); stepInfo(); };

  $('#blkForm').addEventListener('submit', async e => {
    e.preventDefault();
    const status = $('#fStatus'), btn = $('#fSubmit');
    const name = $('#fName').value.trim(), phone = $('#fPhone').value.trim();
    status.className = 'status err';
    if (name.length < 2) { status.textContent = 'Add meg a neved.'; $('#fName').focus(); return; }
    if (phone.replace(/\D/g, '').length < 8) { status.textContent = 'Adj meg egy érvényes telefonszámot.'; $('#fPhone').focus(); return; }
    if (!$('#fConsent').checked) { status.textContent = 'A foglaláshoz fogadd el az adatkezelést.'; return; }
    btn.disabled = true; status.className = 'status'; status.textContent = 'Foglalás folyamatban…';
    const payload = { spec: st.spec, svc: st.svc, date: st.date, start: st.time, name, phone, email: $('#fEmail').value.trim(), note: $('#fNote').value.trim(), website: $('#fWeb').value, consent: true };
    try {
      const r = await api('/api/book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      // e-mail értesítés a stúdiónak (Netlify Forms) – ha nincs bekapcsolva, csendben kihagyjuk
      fetch('/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ 'form-name': 'foglalas', szakember: r.booking.specName, szolgaltatas: r.booking.svcName, datum: r.booking.date, idopont: `${r.booking.start}–${r.booking.end}`, nev: name, telefon: phone, email: payload.email, megjegyzes: payload.note }).toString() }).catch(() => {});
      showDone(r.booking);
    } catch (err) {
      btn.disabled = false; status.className = 'status err'; status.textContent = err.message;
      if (err.code === 'taken' || err.code === 'too_soon') { st.time = null; loadAvail(); renderForm(); stepInfo(); }
    }
  });
  }
  function showDone(b) {
    const S = specById(st.spec);
    document.querySelectorAll('#stepList li').forEach(li => { li.classList.add('done'); li.classList.remove('cur'); });
    $('#panel').replaceChildren(el('div', { class: 'done-box' },
      el('div', { class: 'ring' }, icon('check')),
      el('p', { class: 'eyebrow' }, 'Sikeres foglalás'),
      el('h3', {}, 'Várunk szeretettel!'),
      el('p', { class: 'lead' }, `${fmtDay(b.date)}, ${b.start}–${b.end}`),
      el('p', { class: 'muted' }, `${b.svcName} · ${b.specName}`),
      el('p', { class: 'muted', style: 'max-width:46ch' }, `Ha mégsem tudsz jönni, kérjük, jelezd minél előbb: ${S.phone}`),
      el('button', { class: 'btn line', type: 'button', onclick: () => location.reload() }, 'Újabb foglalás')));
  }

  /* ---------- map (click to load) ---------- */
  $('#mapLoad')?.addEventListener('click', () => {
    $('#map').replaceChildren(el('iframe', { title: 'BYP Stúdió a térképen', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade', src: 'https://www.google.com/maps?q=Hajd%C3%BAszoboszl%C3%B3,+Luther+u.+11&z=16&output=embed' }));
  });

  /* ---------- guestbook ---------- */
  let gbEntries = [], gbShown = 6;
  const stars = n => { const w = el('span', { class: 'rating', 'aria-label': `${n} csillag az 5-ből` }); for (let i = 1; i <= 5; i++) { const ic = icon('star'); if (i <= n) ic.classList.add('on'); w.append(ic); } return w; };
  const ago = iso => new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' });
  function renderGuestbook() {
    const list = $('#gbList'); list.replaceChildren();
    const sc = $('#gbScore');
    if (!gbEntries.length) {
      sc.hidden = true; $('#gbMoreWrap').hidden = true;
      list.append(el('div', { class: 'gb-empty', style: 'column-span:all' }, 'Legyél te az első, aki ír nekünk.'));
      return;
    }
    const avg = gbEntries.reduce((a, e) => a + e.rating, 0) / gbEntries.length;
    sc.hidden = false;
    sc.replaceChildren(el('b', {}, avg.toFixed(1).replace('.', ',')), el('div', {}, stars(Math.round(avg)), el('small', {}, `${gbEntries.length} értékelés alapján`)));
    for (const e of gbEntries.slice(0, gbShown)) {
      const S = e.spec && specById(e.spec);
      list.append(el('article', { class: 'gb-entry' },
        stars(e.rating),
        el('blockquote', {}, e.text),
        e.reply ? el('div', { class: 'gb-reply' }, el('b', {}, 'A stúdió válasza'), e.reply) : null,
        el('footer', {}, el('span', {}, el('b', {}, e.name), S ? ' · ' + (S.short || S.name) : ''), el('span', {}, ago(e.createdAt)))));
    }
    $('#gbMoreWrap').hidden = gbEntries.length <= gbShown;
  }
  // csillagos értékelés: a kattintott csillag és az előtte lévők színeződnek be
  let gbRating = 0;
  const LABELS = ['', '1 / 5 · Nem voltam elégedett', '2 / 5 · Lehetett volna jobb', '3 / 5 · Jó volt', '4 / 5 · Nagyon jó volt', '5 / 5 · Kiváló!'];
  const starBtns = [...document.querySelectorAll('#rate .rate-star')];
  const paintStars = n => starBtns.forEach((b, i) => b.classList.toggle('on', i < n));
  const setRating = n => {
    gbRating = n; paintStars(n);
    starBtns.forEach((b, i) => { b.setAttribute('aria-checked', String(i + 1 === n)); b.tabIndex = (n ? i + 1 === n : i === 0) ? 0 : -1; });
    const t = $('#rateText'); if (!t) return; t.textContent = n ? LABELS[n] : 'Kattints egy csillagra'; t.classList.toggle('set', !!n);
  };
  setRating(0);
  starBtns.forEach((b, i) => {
    b.addEventListener('click', () => setRating(i + 1));
    b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') paintStars(i + 1); });
    b.addEventListener('keydown', e => {
      const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      if (!k) return; e.preventDefault();
      const n = Math.min(5, Math.max(1, gbRating ? gbRating + k : 1));
      setRating(n); starBtns[n - 1].focus();
    });
  });
  $('#rate')?.addEventListener('pointerleave', () => paintStars(gbRating));

  // szakember-választó gombsor ("Nem kívánom megadni" is választható)
  const pickers = {};
  function makePicker(id) {
    const box = $(id); let val = '';
    const opts = [...CFG.specialists.map(s => [s.id, s.name]), ['', 'Nem kívánom megadni']];
    const render = () => { box.replaceChildren(...opts.map(([v, lab]) => el('button', { type: 'button', role: 'radio', class: v ? '' : 'none', 'aria-checked': String(val === v), onclick: () => { val = v; render(); } }, lab))); };
    render();
    pickers[id] = { get value() { return val; }, get label() { return val ? opts.find(o => o[0] === val)[1] : 'Nem adta meg'; } };
  }
  $('#gbMore')?.addEventListener('click', () => { gbShown += 6; renderGuestbook(); });
  const netlifyForm = (name, data) => fetch('/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ 'form-name': name, ...data }).toString() }).catch(() => {});
  const thanks = (title, text) => el('div', { class: 'thanks' }, el('div', { class: 'ring' }, icon('check')), el('h3', {}, title), el('p', { class: 'muted', style: 'max-width:44ch' }, text));
  $('#gbForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const st = $('#gbStatus'), btn = $('#gbSubmit'); st.className = 'status err';
    const name = $('#gbName').value.trim(), text = $('#gbText').value.trim();
    const rating = gbRating;
    if (!rating) { st.textContent = 'Kattints a csillagokra az értékeléshez.'; starBtns[0].focus(); return; }
    if (name.length < 2) { st.textContent = 'Add meg a neved (keresztnév is elég).'; $('#gbName').focus(); return; }
    if (text.length < 5) { st.textContent = 'Írj néhány szót a bejegyzésbe.'; $('#gbText').focus(); return; }
    if (!$('#gbConsent').checked) { st.textContent = 'Fogadd el, hogy a bejegyzésed megjelenjen az oldalon.'; return; }
    btn.disabled = true; st.className = 'status'; st.textContent = 'Küldés…';
    try {
      await api('/api/guestbook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, text, rating, spec: pickers['#gbSpec'].value, consent: true, website: $('#gbWeb').value }) });
      netlifyForm('vendegkonyv', { nev: name, ertekeles: String(rating), szakember: pickers['#gbSpec'].label, bejegyzes: text });
      $('#gbForm').replaceWith(thanks('Köszönjük a kedves szavakat!', 'A bejegyzésedet hamarosan átnézzük, és utána megjelenik a vendégkönyvben.'));
    } catch (err) { btn.disabled = false; st.className = 'status err'; st.textContent = err.message; }
  });

  /* ---------- feedback ---------- */
  const TOPICS = ['Dicséret', 'Javaslat', 'Panasz', 'Kérdés', 'Egyéb'];
  let fbTopic = 'Javaslat';
  function renderTopics() {
    const box = $('#fbTopics'); if (!box) return; box.replaceChildren();
    for (const t of TOPICS) box.append(el('button', { type: 'button', class: 'fb-topic', role: 'radio', 'aria-checked': String(fbTopic === t), onclick: () => { fbTopic = t; renderTopics(); } }, t));
  }
  renderTopics();
  $('#fbContact')?.addEventListener('input', () => { $('#fbConsentRow').hidden = !$('#fbContact').value.trim(); });
  $('#fbForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const st = $('#fbStatus'), btn = $('#fbSubmit'); st.className = 'status err';
    const text = $('#fbText').value.trim(), contact = $('#fbContact').value.trim();
    if (text.length < 5) { st.textContent = 'Írd le pár szóban a visszajelzésed.'; $('#fbText').focus(); return; }
    if (contact && !$('#fbConsent').checked) { st.textContent = 'Ha elérhetőséget adsz meg, fogadd el az adatkezelést.'; return; }
    btn.disabled = true; st.className = 'status'; st.textContent = 'Küldés…';
    const data = { topic: fbTopic, spec: pickers['#fbSpec'].value, name: $('#fbName').value.trim(), contact, text, consent: !!contact, website: $('#fbWeb').value };
    try {
      await api('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      netlifyForm('visszajelzes', { tema: data.topic, szakember: pickers['#fbSpec'].label, nev: data.name, elerhetoseg: contact, uzenet: text });
      $('#fbForm').replaceChildren(thanks('Köszönjük, megkaptuk!', contact ? 'Hamarosan jelentkezünk a megadott elérhetőségen.' : 'Minden visszajelzést elolvasunk, és sokat segít nekünk.'));
    } catch (err) { btn.disabled = false; st.className = 'status err'; st.textContent = err.message; }
  });

  /* ---------- start ---------- */
  (async () => {
    try { CFG = await api('/api/config'); }
    catch { const t = $('#team') || $('#panel') || $('#gal') || $('#gbList'); t?.replaceChildren(el('p', { class: 'status err' }, 'Az oldal betöltése nem sikerült. Frissítsd az oldalt.')); return; }
    const has = id => !!$(id);
    if (has('#team')) renderTeam();
    if (has('#panel')) {
      renderBooking();
      const pre = new URLSearchParams(location.search).get('szakember');
      if (pre && specById(pre)) selectSpec(pre);
    }
    if (has('#gbSpec')) makePicker('#gbSpec');
    if (has('#fbSpec')) makePicker('#fbSpec');
    if (has('#gbList') || has('#exGb')) {
      if (has('#gbList')) renderGuestbook();
      api('/api/guestbook').then(r => {
        gbEntries = r.entries || [];
        if (has('#gbList')) renderGuestbook();
        if (has('#exGb') && gbEntries.length) { const avg = gbEntries.reduce((a, e) => a + e.rating, 0) / gbEntries.length; $('#exGb').textContent = `${avg.toFixed(1).replace('.', ',')} / 5 csillag, ${gbEntries.length} vendég véleménye alapján. Olvasd el, vagy írj te is.`; }
      }).catch(() => {});
    }
    if (has('#gal')) {
      renderGalFilter(); renderGallery();
      try { images = (await api('/api/gallery')).images || []; renderGallery(); } catch {}
    }
  })();
})();
