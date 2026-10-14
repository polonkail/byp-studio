// E-mail értesítés új online foglalásról – Gmail-fiókon keresztül (ingyenes, Netlify Pro nélkül).
// Netlify környezeti változók:
//   SMTP_USER    – a küldő Gmail-cím (pl. bypstudio11@gmail.com)
//   SMTP_PASS    – a Gmail „alkalmazásjelszava” (16 betű, Google-fiók → Biztonság → Alkalmazásjelszavak)
//   NOTIFY_PETRA, NOTIFY_CSILLA … – a szakember e-mail-címe(i), vesszővel több is megadható
//   NOTIFY_ALL   – (nem kötelező) ide minden foglalás megy
import nodemailer from 'nodemailer';

let tx = null;
const transport = () => tx ||= nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || '').replace(/\s+/g, '') },
});
export const mailEnabled = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);
export const recipientsFor = specId => [process.env['NOTIFY_' + String(specId).toUpperCase()], process.env.NOTIFY_ALL]
  .filter(Boolean).join(',').split(',').map(s => s.trim()).filter(Boolean);

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DAYS = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
const dayTxt = d => { const [y, m, dd] = d.split('-').map(Number); return `${y}. ${String(m).padStart(2, '0')}. ${String(dd).padStart(2, '0')}. (${DAYS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]})`; };

export async function sendMail({ to, subject, text, html }) {
  return transport().sendMail({ from: `"BYP Stúdió foglalás" <${process.env.SMTP_USER}>`, to, subject, text, html });
}

/** Értesítő levél egy új foglalásról. Hiba esetén csak naplóz, a foglalást nem akadályozza. */
export async function notifyBooking(b) {
  if (!mailEnabled()) return;
  const to = [...new Set(recipientsFor(b.spec))];
  if (!to.length) return;
  const svc = (b.items || []).map(i => i.name.split(' (')[0]).join(', ') || b.svcName;
  const subject = `Új foglalás: ${b.date.slice(5).replace('-', '.')}. ${b.start} – ${b.name} (${svc})`;
  const rows = [
    ['Időpont', `${dayTxt(b.date)} ${b.start}–${b.end}`], ['Szakember', b.specName], ['Szolgáltatás', b.svcName],
    ['Várható ár', b.price], ['Vendég', b.name], ['Telefon', b.phone], ['E-mail', b.email], ['Megjegyzés', b.note],
  ].filter(([, v]) => v);
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + '\n\nAdmin naptár: https://bypstudio.hu/feltoltes/';
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#221c1e">
<h2 style="font-weight:normal;margin:0 0 12px">Új online foglalás</h2>
<table cellpadding="6" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="color:#8a7f78;padding-right:16px">${esc(k)}</td><td><b>${k === 'Telefon' ? `<a href="tel:${esc(String(v).replace(/\s/g, ''))}">${esc(v)}</a>` : esc(v)}</b></td></tr>`).join('')}</table>
<p style="margin-top:18px"><a href="https://bypstudio.hu/feltoltes/" style="color:#a67c45">Megnyitás az admin naptárban</a></p></div>`;
  try { await sendMail({ to: to.join(','), subject, text, html }); }
  catch (e) { console.error('notify: ' + e.message); }
}
