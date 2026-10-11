# Executed from build_pages.py (shares its helpers: ROOT, write, page_head, header, page_hero, footer, script).
# Builds /arlista/ as static HTML from netlify/lib/config.mjs, so the price list and the booking use the same data.
import json, subprocess, html as H

_cfg_path = os.path.abspath(os.path.join(ROOT, 'netlify/lib/config.mjs'))
cfg = json.loads(subprocess.check_output(['node', '-e', "import('" + _cfg_path + "').then(m=>console.log(JSON.stringify({s:m.SPECIALISTS,l:m.LENGTHS})))"]))
NB = ' '


def ft(n):
    return f"{n:,}".replace(',', NB) + NB + 'Ft'


def table(title, services, wide=False):
    has_len = any(v.get('prices') for v in services)
    rows = []
    for v in services:
        name = H.escape(v['name'])
        if has_len and v.get('prices'):
            cells = ''
            for L, p in zip(cfg['l'], v['prices']):
                cls = ' class="na"' if p is None else ''
                cells += '<td data-label="%s"%s>%s</td>' % (L['name'], cls, '–' if p is None else ft(p))
        else:
            txt = v.get('priceText') or (ft(v['price']) if v.get('price') else '')
            span = ' colspan="3"' if has_len else ''
            cells = '<td class="span"%s>%s</td>' % (span, H.escape(txt))
        rows.append('<tr><th scope="row">%s</th>%s</tr>' % (name, cells))
    if has_len:
        head = '<thead><tr><th>Szolgáltatás</th>' + ''.join('<th>%s</th>' % L['name'] for L in cfg['l']) + '</tr></thead>'
    else:
        head = '<thead><tr><th>Szolgáltatás</th><th>Ár</th></tr></thead>'
    return '<div class="ptable-box%s"><h3>%s</h3><table class="ptable%s">%s<tbody>%s</tbody></table></div>' % (
        ' wide' if wide else '', H.escape(title), '' if has_len else ' single', head, ''.join(rows))


NOTE_ICONS = ['leaf', 'droplet', 'clock', 'calendar-days']
blocks, others = [], []
for sp in cfg['s']:
    if sp.get('categories'):
        tbls = []
        for c in sp['categories']:
            for g in c['groups']:
                if c['id'] == 'noi' and g['name'].startswith('Vágás'):
                    title, wide = 'Női – vágás, festés, styling', True
                elif g['name'] == c['name']:
                    title, wide = c['name'], False
                else:
                    title, wide = g['name'], False
                tbls.append(table(title, g['services'], wide))
        notes = ''.join('<li><svg class="ico"><use href="#i-%s"/></svg><span>%s</span></li>' % (NOTE_ICONS[i % 4], H.escape(n))
                        for i, n in enumerate(sp.get('priceNotes', [])))
        blocks.append('''      <article class="pl-spec rv" id="%s">
        <div class="pl-spec-head"><div><h2>Fodrászat</h2><p class="role">%s &middot; %s</p></div>
          <a class="btn" href="/foglalas/?szakember=%s"><svg class="ico"><use href="#i-calendar-days"/></svg>Időpontot foglalok</a></div>
        <div class="pl-tables">%s</div>
        <ul class="pl-notes">%s</ul>
      </article>''' % (sp['id'], H.escape(sp['name']), H.escape(sp['phone']), sp['id'], ''.join(tbls), notes))
    else:
        items = ''.join('<li>%s</li>' % H.escape(v['name']) for v in sp['services'])
        others.append('''<div class="pl-card" id="%s"><p class="role">%s</p><h3>%s</h3>
          <ul class="svc-list" style="font-size:.95rem">%s</ul>
          <p class="muted small">Az árakról érdeklődj közvetlenül: <a class="tel" href="tel:%s">%s</a></p>
          <a class="textlink" href="/foglalas/?szakember=%s">Időpontot foglalok <svg class="ico"><use href="#i-arrow-right"/></svg></a></div>''' % (
            sp['id'], H.escape(sp['role']), H.escape(sp['name']), items, sp['phone'].replace(' ', ''), H.escape(sp['phone']), sp['id']))
if others:
    blocks.append('''      <article class="pl-spec rv">
        <div class="pl-spec-head"><div><h2>Köröm, pedikűr, szempilla</h2><p class="role">Árak hamarosan</p></div></div>
        <div class="pl-other">%s</div>
      </article>''' % ''.join(others))

pl = '  <section class="sec silk" id="arlista">\n    <div class="wrap pl-wrap">\n' + '\n'.join(blocks) + '\n    </div>\n  </section>\n'
write('arlista/index.html',
      page_head('Árlista · BYP Studio Hajdúszoboszló', 'A BYP Studio fodrászat árlistája: női, férfi és gyerek hajvágás, festés, melír, balayage, hajhosszabbítás és hajápolás árai, Hajdúszoboszló.')
      + header('arlista') + '\n<main id="top">\n'
      + page_hero('Árlista', 'Áraink <em>átláthatóan</em>', 'Az árak forintban értendő bruttó szalonárak. A végső ár a hajhossztól és a felhasznált anyag mennyiségétől függ.')
      + pl + '</main>\n\n' + footer + '\n\n' + script + '\n</body>\n</html>\n')
