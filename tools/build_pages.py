"""Builds the separate pages (főoldal, galéria, vendégkönyv, foglalás) from tools/src/full.html.
Run: python3 tools/build_pages.py   (from the project root)"""
import re, os

ROOT = os.path.join(os.path.dirname(__file__), '..')
src = open(os.path.join(ROOT, 'tools/src/full.html'), encoding='utf-8').read()


def cut(start_marker, end_marker, text=src, include_end=True):
    a = text.index(start_marker)
    b = text.index(end_marker, a) + (len(end_marker) if include_end else 0)
    return text[a:b]


def section(sid):
    m = re.search(r'  <section class="[^"]*" id="%s">.*?\n  </section>\n' % sid, src, re.S)
    return m.group(0)


head_tpl = src[:src.index('<header class="site-head"')]
footer = cut('<footer class="site-foot">', '</footer>')
lightbox = cut('<div class="lightbox"', '</figure>\n</div>')
forms = cut('<!-- Netlify Forms', '<script src="/assets/js/site.js', include_end=False)
script = re.search(r'<script src="/assets/js/site\.js[^"]*" defer></script>', src).group(0)

NAV = [('rolunk', '/#rolunk', 'Rólunk'), ('szolgaltatasok', '/#szolgaltatasok', 'Szolgáltatások'),
       ('galeria', '/galeria/', 'Galéria'), ('vendegkonyv', '/vendegkonyv/', 'Vendégkönyv'),
       ('foglalas', '/foglalas/', 'Időpontfoglalás'), ('visszajelzes', '/visszajelzes/', 'Visszajelzés'),
       ('kapcsolat', '/#kapcsolat', 'Kapcsolat')]


def header(active):
    links = '\n'.join(f'      <a href="{href}"{" aria-current=\"page\"" if key == active else ""}>{label}</a>' for key, href, label in NAV)
    return f'''<header class="site-head" id="head">
  <div class="wrap">
    <a class="logo" href="/" aria-label="BYP Studio, főoldal">
      <img class="logo-img" src="/assets/img/logo-monogram.png" alt="BYP Studio" width="74" height="62" style="height:62px;width:auto">
    </a>
    <nav class="nav" id="nav" aria-label="Fő menü">
{links}
    </nav>
    <a class="btn line head-cta" href="/foglalas/" style="--b:var(--gold-lt)">Foglalás</a>
    <button class="burger" id="burger" aria-label="Menü" aria-expanded="false" aria-controls="nav"><svg class="ico"><use href="#i-menu"/></svg></button>
  </div>
</header>
'''


def page_head(title, desc):
    h = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', head_tpl, flags=re.S)
    h = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{desc}">', h)
    return h


def page_hero(eyebrow, title_html, lead):
    return f'''  <section class="page-hero on-dark">
    <div class="wrap">
      <p class="eyebrow rv">{eyebrow}</p>
      <h1 class="rv">{title_html}</h1>
      <p class="lead rv">{lead}</p>
    </div>
  </section>
'''


def write(path, html):
    full = os.path.join(ROOT, 'public', path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w', encoding='utf-8').write(html)
    print('wrote', path, len(html))


# ---------- main page ----------
explore = '''  <section class="sec explore" id="felfedezes">
    <div class="wrap">
      <div class="sec-head rv">
        <p class="eyebrow">Fedezd fel</p>
        <h2>Nézz be <em>hozzánk</em></h2>
      </div>
      <div class="explore-grid rv">
        <a class="ex-card" href="/galeria/">
          <svg class="ico"><use href="#i-image"/></svg>
          <span class="ex-t">Galéria</span>
          <span class="ex-d">Frizurák, körmök, szempilla: nézd meg a munkáinkat közelről.</span>
          <span class="textlink">Megnézem <svg class="ico"><use href="#i-arrow-right"/></svg></span>
        </a>
        <a class="ex-card" href="/vendegkonyv/">
          <svg class="ico"><use href="#i-quote"/></svg>
          <span class="ex-t">Vendégkönyv</span>
          <span class="ex-d" id="exGb">Olvasd el, mit írtak rólunk a vendégeink, vagy írj te is.</span>
          <span class="textlink">Elolvasom <svg class="ico"><use href="#i-arrow-right"/></svg></span>
        </a>
        <a class="ex-card" href="/visszajelzes/">
          <svg class="ico"><use href="#i-message"/></svg>
          <span class="ex-t">Visszajelzés</span>
          <span class="ex-d">Ötleted, kérdésed van? Írd meg nekünk, akár névtelenül is.</span>
          <span class="textlink">Írok nektek <svg class="ico"><use href="#i-arrow-right"/></svg></span>
        </a>
        <a class="ex-card dark" href="/foglalas/">
          <svg class="ico"><use href="#i-calendar-days"/></svg>
          <span class="ex-t">Időpontfoglalás</span>
          <span class="ex-d">Válaszd ki a szakembert, a szolgáltatást és a szabad időpontot.</span>
          <span class="textlink">Foglalok <svg class="ico"><use href="#i-arrow-right"/></svg></span>
        </a>
      </div>
    </div>
  </section>

'''
hero = re.search(r'  <section class="hero on-dark">.*?\n  </section>\n', src, re.S).group(0)
hero = hero.replace('href="#foglalas"', 'href="/foglalas/"')
main_body = ('<main id="top">\n' + hero + '\n' + section('rolunk') + '\n' + section('szolgaltatasok') + '\n'
             + explore + section('kapcsolat') + '</main>\n\n')
write('index.html', page_head('BYP Studio · Szépségstúdió Hajdúszoboszló',
                              'BYP Studio, Hajdúszoboszló: fodrászat, kézápolás, műköröm, pedikűr, szempilla-hosszabbítás és fülbelövés egy helyen. Foglalj időpontot online.')
      + header('') + '\n' + main_body + footer + '\n\n' + forms + script + '\n</body>\n</html>\n')

# ---------- gallery ----------
gal = section('galeria')
gal = re.sub(r'\s*<div class="sec-head rv">\s*<p class="eyebrow">Galéria</p>.*?</div>\n', '\n', gal, count=1, flags=re.S)
gal = gal.replace('class="sec on-dark marble-band" id="galeria"', 'class="sec on-dark marble-band page-first" id="galeria"')
write('galeria/index.html', page_head('Galéria · BYP Studio', 'A BYP Studio munkái: frizurák, körmök, szempilla és pedikűr.')
      + header('galeria') + '\n<main id="top">\n'
      + page_hero('Galéria', 'Munkáink <em>közelről</em>', 'Válogatás a stúdió négy szakemberének munkáiból.')
      + gal + '</main>\n\n' + footer + '\n\n' + lightbox + '\n\n' + script + '\n</body>\n</html>\n')

# ---------- guestbook ----------
gb = section('vendegkonyv')
gb = re.sub(r'<div class="sec-head" style="margin-bottom:0">.*?</div>', '<p class="lead">Köszönjük minden vendégünknek a kedves szavakat. Olvasd el, mit írtak rólunk, vagy írj te is.</p>', gb, count=1, flags=re.S)
write('vendegkonyv/index.html', page_head('Vendégkönyv · BYP Studio', 'Vendégeink véleménye a BYP Studióról. Írj te is a vendégkönyvünkbe.')
      + header('vendegkonyv') + '\n<main id="top">\n'
      + page_hero('Vendégkönyv', 'Akik már <em>nálunk</em> jártak', 'Vendégeink szavai, csillagai és emlékei a BYP Studióból.')
      + gb + '</main>\n\n' + footer + '\n\n' + script + '\n</body>\n</html>\n')

# ---------- booking ----------
bk = section('foglalas')
bk = re.sub(r'\s*<div class="sec-head center rv">.*?</div>\n', '\n', bk, count=1, flags=re.S)
write('foglalas/index.html', page_head('Időpontfoglalás · BYP Studio', 'Foglalj időpontot online a BYP Studióba: válaszd ki a szakembert, a szolgáltatást és a szabad időpontot.')
      + header('foglalas') + '\n<main id="top">\n'
      + page_hero('Online időpontfoglalás', 'Válaszd ki a <em>te</em> időpontodat', 'A naptárban zölddel látod a szabad időpontokat. Pár kattintás, és már várunk is.')
      + bk + '</main>\n\n' + footer + '\n\n' + script + '\n</body>\n</html>\n')

# ---------- feedback ----------
fb = section('visszajelzes')
fb = re.sub(r'\s*<p class="eyebrow">Visszajelzés</p>\s*<h2>.*?</h2>', '', fb, count=1, flags=re.S)
write('visszajelzes/index.html', page_head('Visszajelzés · BYP Studio', 'Írd meg nekünk a véleményed, ötleted vagy kérdésed. Az üzenetet csak a BYP Studio munkatársai olvassák.')
      + header('visszajelzes') + '\n<main id="top">\n'
      + page_hero('Visszajelzés', 'Mondd el <em>őszintén</em>', 'Minden üzenetet elolvasunk, és sokat segít nekünk, hogy még jobbak legyünk.')
      + fb + '</main>\n\n' + footer + '\n\n' + script + '\n</body>\n</html>\n')
