# Executed from build_pages.py (shares its helpers: ROOT, write, page_head, header, page_hero, footer, script).
# Builds /arlista/ (szakember-választó) and /arlista/<szakember>/ pages from netlify/lib/config.mjs,
# so the price lists and the booking use the same data.
import json, subprocess, html as H

_cfg_path = os.path.abspath(os.path.join(ROOT, 'netlify/lib/config.mjs'))
cfg = json.loads(subprocess.check_output(['node', '-e', "import('" + _cfg_path + "').then(m=>console.log(JSON.stringify({s:m.SPECIALISTS,l:m.LENGTHS})))"]))
NB = ' '
E = H.escape


def ft(n):
    return f"{n:,}".replace(',', NB) + NB + 'Ft'


def table(title, rows, cols=None, wide=False):
    """rows: [{name, desc?, prices?[] | price? | priceText?}]; cols: column names when rows have per-column prices."""
    has_cols = bool(cols) and any(r.get('prices') for r in rows)
    out = []
    for r in rows:
        name = E(r['name']) + ('<small class="pdesc">%s</small>' % E(r['desc']) if r.get('desc') else '')
        if has_cols and r.get('prices'):
            cells = ''.join('<td data-label="%s"%s>%s</td>' % (E(c), ' class="na"' if p is None else '', '–' if p is None else ft(p))
                            for c, p in zip(cols, r['prices']))
        else:
            txt = r.get('priceText') or (ft(r['price']) if r.get('price') else '')
            span = ' colspan="%d"' % len(cols) if has_cols else ''
            cells = '<td class="span"%s>%s</td>' % (span, E(txt))
        out.append('<tr><th scope="row">%s</th>%s</tr>' % (name, cells))
    head = '<thead><tr><th>Szolgáltatás</th>' + (''.join('<th>%s</th>' % E(c) for c in cols) if has_cols else '<th>Ár</th>') + '</tr></thead>'
    style = ' style="--cols:%d"' % len(cols) if has_cols else ''
    return '<div class="ptable-box%s"><h3>%s</h3><table class="ptable%s"%s>%s<tbody>%s</tbody></table></div>' % (
        ' wide' if wide else '', E(title), '' if has_cols else ' single', style, head, ''.join(out))


NOTE_ICONS = ['leaf', 'droplet', 'clock', 'calendar-days']


def spec_view(sp):
    """Returns (title, intro, tables_html, notes[])"""
    if sp.get('categories'):
        cols = [L['name'] for L in (sp.get('lengths') or cfg['l'])]
        tbls = []
        for c in sp['categories']:
            for g in c['groups']:
                if c['id'] == 'noi' and g['name'].startswith('Vágás'):
                    title, wide = 'Női – vágás, festés, styling', True
                elif g['name'] == c['name'] or c.get('hideName'):
                    title, wide = g['name'], False
                else:
                    title, wide = g['name'], False
                rows = [{'name': v['name'], **{k: v[k] for k in ('prices', 'price', 'priceText') if k in v}} for v in g['services']]
                tbls.append(table(title, rows, cols if any(v.get('prices') for v in g['services']) else None, wide or g.get('wide', False)))
        return sp.get('plTitle', sp['role']), sp.get('plIntro', ''), ''.join(tbls), sp.get('priceNotes', [])
    pl = sp['priceList']
    tbls = ''.join(table(g['name'], g['rows'], g.get('cols'), g.get('wide', False)) for g in pl['groups'])
    return pl['title'], pl.get('intro', ''), tbls, pl.get('notes', [])


def first_name(sp):
    return sp['name'].split(' ')[-1]


specs = [s for s in cfg['s'] if s.get('categories') or s.get('priceList')]

# ---------- választó (/arlista/) ----------
cards = []
for sp in specs:
    title, intro, _, _ = spec_view(sp)
    cards.append('''        <a class="pl-pick-card" href="/arlista/%s/">
          <span class="pl-pick-ico"><svg class="ico"><use href="#i-%s"/></svg></span>
          <span class="pl-pick-t">%s</span>
          <span class="pl-pick-n">%s</span>
          <span class="pl-pick-d">%s</span>
          <span class="textlink">Árlista megnyitása <svg class="ico"><use href="#i-arrow-right"/></svg></span>
        </a>''' % (sp['id'], sp['icon'], E(title), E(sp['name']), E(sp['role'])))
picker = ('  <section class="sec silk" id="arlista">\n    <div class="wrap">\n      <p class="lead pl-pick-lead">Válaszd ki a szakembert, akinek az árlistáját meg szeretnéd nézni.</p>\n'
          '      <div class="pl-pick">\n' + '\n'.join(cards) + '\n      </div>\n    </div>\n  </section>\n')
write('arlista/index.html',
      page_head('Árlista · BYP Studio Hajdúszoboszló', 'A BYP Studio árlistái: fodrászat, kéz- és lábápolás, műköröm, gél lakk, pedikűr, szempillaépítés és fülbelövés, Hajdúszoboszló.')
      + header('arlista') + '\n<main id="top">\n'
      + page_hero('Árlista', 'Áraink <em>átláthatóan</em>', 'Négy szakember, négy árlista. Az árak forintban értendő bruttó árak.')
      + picker + '</main>\n\n' + footer + '\n\n' + script + '\n</body>\n</html>\n')

# ---------- szakemberenkénti oldalak (/arlista/<id>/) ----------
for sp in specs:
    title, intro, tbls, notes = spec_view(sp)
    switch = ''.join('<a class="pl-chip" href="/arlista/%s/"%s>%s</a>' % (o['id'], ' aria-current="page"' if o['id'] == sp['id'] else '', E(o.get('short') or o['name']))
                     for o in specs)
    if sp.get('booking') == 'messenger':
        cta = '<a class="btn" href="%s" target="_blank" rel="noopener"><svg class="ico"><use href="#i-messenger"/></svg>Időpont-egyeztetés</a>' % E(sp['messenger'])
    else:
        cta = '<a class="btn" href="/foglalas/?szakember=%s"><svg class="ico"><use href="#i-calendar-days"/></svg>Időpontot foglalok</a>' % sp['id']
    note_html = ''.join('<li><svg class="ico"><use href="#i-%s"/></svg><span>%s</span></li>' % (NOTE_ICONS[i % 4], E(n)) for i, n in enumerate(notes))
    body = '''  <section class="sec silk" id="arlista">
    <div class="wrap pl-wrap">
      <nav class="pl-switch" aria-label="Árlista kiválasztása"><a class="textlink pl-back" href="/arlista/"><svg class="ico flip"><use href="#i-arrow-right"/></svg>Összes árlista</a><div class="pl-chips">%s</div></nav>
      <article class="pl-spec rv" id="%s">
        <div class="pl-spec-head"><div><h2>%s</h2><p class="role">%s &middot; <a class="tel" href="tel:%s">%s</a></p></div>
          %s</div>
        <div class="pl-tables">%s</div>
        %s
      </article>
    </div>
  </section>
''' % (switch, sp['id'], E(title), E(sp['name']), sp['phone'].replace(' ', ''), E(sp['phone']), cta, tbls,
       '<ul class="pl-notes">%s</ul>' % note_html if note_html else '')
    write('arlista/%s/index.html' % sp['id'],
          page_head('%s árlista · %s · BYP Studio' % (title, sp['name']), E('%s árai a BYP Studióban (Hajdúszoboszló): %s.' % (sp['name'], title.lower())))
          + header('arlista') + '\n<main id="top">\n'
          + page_hero('Árlista · ' + E(sp['name']), E(title), E(intro))
          + body + '</main>\n\n' + footer + '\n\n' + script + '\n</body>\n</html>\n')
