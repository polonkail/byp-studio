// Google Naptár szinkron (szolgáltatásfiókkal, külső csomag nélkül).
// Beállítás a Netlify környezeti változóiban:
//   GOOGLE_SERVICE_ACCOUNT  – a Google Cloudban letöltött szolgáltatásfiók-kulcs teljes JSON tartalma
//   GCAL_PETRA              – a naptár azonosítója, pl. decseipetra01@gmail.com
// A naptárat meg kell osztani a szolgáltatásfiók e-mail-címével „Módosíthatja az eseményeket” joggal.
import { createSign } from 'node:crypto';
import { SALON } from './config.mjs';

let cachedToken = null, tokenExp = 0;
const b64url = buf => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

// A kulcs megadható a teljes JSON-nal (GOOGLE_SERVICE_ACCOUNT), base64-ben, vagy két külön változóban
// (GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY). Visszaad: { email, key } vagy { error }.
function readAccount() {
  const fixKey = k => String(k || '').replace(/\\n/g, '\n').replace(/^"|"$/g, '').trim();
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)
    return { email: process.env.GOOGLE_CLIENT_EMAIL.trim(), key: fixKey(process.env.GOOGLE_PRIVATE_KEY) };
  let raw = (process.env.GOOGLE_SERVICE_ACCOUNT || '').trim();
  if (!raw) return { error: 'missing' };
  if (!raw.startsWith('{')) { try { const dec = Buffer.from(raw, 'base64').toString('utf8').trim(); if (dec.startsWith('{')) raw = dec; } catch {} }
  if (raw.startsWith("'") || (raw.startsWith('"') && !raw.startsWith('{'))) raw = raw.slice(1, -1);
  let j; try { j = JSON.parse(raw); } catch { return { error: 'json' }; }
  if (!j.client_email || !j.private_key) return { error: 'fields' };
  return { email: j.client_email, key: fixKey(j.private_key) };
}
function account() { const a = readAccount(); if (a.error) { if (a.error !== 'missing') console.error('gcal: hibás GOOGLE_SERVICE_ACCOUNT (' + a.error + ')'); return null; } return a; }
export const calendarFor = specId => process.env['GCAL_' + String(specId).toUpperCase()] || null;
export const gcalEnabled = specId => !!(calendarFor(specId) && account());

async function token() {
  if (cachedToken && Date.now() < tokenExp - 60000) return cachedToken;
  const acc = account();
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: acc.email, scope: 'https://www.googleapis.com/auth/calendar', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = b64url(createSign('RSA-SHA256').update(`${head}.${claim}`).sign(acc.key));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error('gcal token: ' + (d.error_description || d.error || r.status));
  cachedToken = d.access_token; tokenExp = Date.now() + d.expires_in * 1000;
  return cachedToken;
}
async function call(method, path, body) {
  const r = await fetch('https://www.googleapis.com/calendar/v3' + path, {
    method, headers: { authorization: 'Bearer ' + await token(), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return null;
  const d = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error('gcal ' + method + ' ' + r.status + ': ' + (d?.error?.message || '')); e.status = r.status; throw e; }
  return d;
}

// A Google-esemény azonosítója a foglalás azonosítójából képződik (így törölni is tudjuk tárolás nélkül).
export const eventId = bookingId => 'bk' + Buffer.from(bookingId).toString('hex'); // csak a 0-9 és a-v karakterek engedélyezettek

/** Foglalás vagy lezárás felírása a szakember Google Naptárába. Hiba esetén csak naplóz. */
export async function gcalPush(b) {
  const cal = calendarFor(b.spec);
  if (!cal || !account()) return;
  const tz = SALON.timeZone;
  const isBlock = b.type === 'block';
  const lines = isBlock ? [b.note || 'Lezárt időszak'] : [
    `Szolgáltatás: ${b.svcName}`, b.price ? `Várható ár: ${b.price}` : '', `Vendég: ${b.name}`, b.phone ? `Telefon: ${b.phone}` : '',
    b.email ? `E-mail: ${b.email}` : '', b.note ? `Megjegyzés: ${b.note}` : '', `Forrás: ${b.source === 'telefon' ? 'telefonos foglalás' : 'online foglalás (bypstudio.hu)'}`,
  ];
  const ev = {
    id: eventId(b.id),
    summary: isBlock ? `Zárva${b.note ? ': ' + b.note : ''}` : `${b.name} – ${(b.items || []).map(i => i.name).join(' + ') || b.svcName}`,
    description: lines.filter(Boolean).join('\n'),
    start: { dateTime: `${b.date}T${b.start}:00`, timeZone: tz },
    end: { dateTime: `${b.date}T${b.end}:00`, timeZone: tz },
    colorId: isBlock ? '8' : (b.source === 'telefon' ? '2' : '5'),
    reminders: { useDefault: true },
    transparency: 'transparent', // a saját foglalásaink ne duplázódjanak a „foglalt” lekérdezésben
  };
  try { await call('POST', `/calendars/${encodeURIComponent(cal)}/events`, ev); }
  catch (e) {
    if (e.status === 409) { try { await call('PUT', `/calendars/${encodeURIComponent(cal)}/events/${ev.id}`, ev); } catch (e2) { console.error(e2.message); } }
    else console.error(e.message);
  }
}

/** Esemény törlése (lemondáskor). */
export async function gcalRemove(specId, bookingId) {
  const cal = calendarFor(specId);
  if (!cal || !account()) return;
  try { await call('DELETE', `/calendars/${encodeURIComponent(cal)}/events/${eventId(bookingId)}`); }
  catch (e) { if (e.status !== 404 && e.status !== 410) console.error(e.message); }
}

// UTC időpont → szalon helyi dátum + perc
function local(iso) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: SALON.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
const pad = n => String(n).padStart(2, '0');
const hhmm = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);

/** A Google Naptárban foglalt idősávok (pl. Petra saját bejegyzései) napokra bontva: { 'YYYY-MM-DD': [{start, dur}] } */
export async function gcalBusy(specId, fromDate, toDate) {
  const cal = calendarFor(specId);
  if (!cal || !account()) return {};
  const off = d => new Date(`${d}T00:00:00Z`);
  const timeMin = new Date(off(fromDate).getTime() - 2 * 3600e3).toISOString();
  const timeMax = new Date(off(toDate).getTime() + 26 * 3600e3).toISOString();
  let d;
  try { d = await call('POST', '/freeBusy', { timeMin, timeMax, timeZone: SALON.timeZone, items: [{ id: cal }] }); }
  catch (e) { console.error(e.message); return {}; }
  const out = {};
  for (const iv of d?.calendars?.[cal]?.busy || []) {
    let s = local(iv.start), e = local(iv.end);
    // több napos eseményt napokra bontjuk
    while (s.date < e.date) {
      (out[s.date] ||= []).push({ start: hhmm(s.min), dur: 24 * 60 - s.min });
      const nd = new Date(`${s.date}T12:00:00Z`); nd.setUTCDate(nd.getUTCDate() + 1);
      s = { date: nd.toISOString().slice(0, 10), min: 0 };
    }
    if (e.min > s.min) (out[s.date] ||= []).push({ start: hhmm(s.min), dur: e.min - s.min });
  }
  return out;
}

/** Kapcsolat-ellenőrzés az admin felülethez: lépésenként megmondja, hol akad el a szinkron. */
export async function gcalDiagnose(specIds) {
  const out = { account: null, specs: [] };
  const a = readAccount();
  if (a.error) {
    out.account = { ok: false, msg: {
      missing: 'Nincs beállítva a GOOGLE_SERVICE_ACCOUNT környezeti változó a Netlify-ban (vagy beállítás után nem volt új deploy, vagy a változó hatóköre nem tartalmazza a „Functions” részt).',
      json: 'A GOOGLE_SERVICE_ACCOUNT értéke nem érvényes JSON. A letöltött .json fájl TELJES tartalmát kell bemásolni, a { jeltől a } jelig.',
      fields: 'A GOOGLE_SERVICE_ACCOUNT JSON-ból hiányzik a client_email vagy a private_key. Biztosan a szolgáltatásfiók KULCS fájlját másoltad be?',
    }[a.error] };
    return out;
  }
  out.account = { ok: true, email: a.email };
  try { cachedToken = null; await token(); }
  catch (e) { out.account = { ok: false, email: a.email, msg: /fetch failed/i.test(e.message) ? 'Nem sikerült elérni a Google szervereit, próbáld újra pár perc múlva.' : 'A Google nem fogadta el a kulcsot: ' + e.message + '. Lehet, hogy a kulcsot törölték, vagy a private_key megsérült másoláskor – készíts új JSON kulcsot.' }; return out; }
  for (const id of specIds) {
    const cal = calendarFor(id);
    const r = { spec: id, env: 'GCAL_' + id.toUpperCase(), calendar: cal };
    out.specs.push(r);
    if (!cal) { r.ok = null; r.msg = 'Nincs beállítva (nem kötelező).'; continue; }
    try { await call('GET', `/calendars/${encodeURIComponent(cal)}`); }
    catch (e) {
      r.ok = false;
      r.msg = e.status === 403 && /has not been used|disabled/i.test(e.message)
        ? 'A Google Calendar API nincs bekapcsolva a Google Cloud projektben (APIs & Services → Library → Google Calendar API → Enable).'
        : e.status === 404 || e.status === 403
          ? `A naptár nincs megosztva a szolgáltatásfiókkal. A ${cal} fiók Google Naptárában: Beállítások → a naptár neve → „Megosztás adott személyekkel” → ${a.email} → „Módosíthatja az eseményeket”.`
          : 'Hiba: ' + e.message;
      continue;
    }
    // írási jog próbája: tesztesemény létrehozása és azonnali törlése
    const tid = 'bktest' + Date.now().toString(16);
    const t0 = new Date(Date.now() + 86400e3), t1 = new Date(t0.getTime() + 15 * 60e3);
    try {
      await call('POST', `/calendars/${encodeURIComponent(cal)}/events`, { id: tid, summary: 'BYP teszt', start: { dateTime: t0.toISOString() }, end: { dateTime: t1.toISOString() }, transparency: 'transparent' });
      await call('DELETE', `/calendars/${encodeURIComponent(cal)}/events/${tid}`).catch(() => {});
      r.ok = true; r.msg = 'Rendben: a naptár elérhető, és a weboldal tud bele írni.';
    } catch (e) {
      r.ok = false;
      r.msg = e.status === 403
        ? `A naptár meg van osztva, de csak megtekintési joggal. Állítsd át „Módosíthatja az eseményeket” jogra (${a.email}).`
        : 'Írási hiba: ' + e.message;
    }
  }
  return out;
}
