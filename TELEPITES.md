# BYP Stúdió honlap – telepítés a Netlify-ra

## Mi van a csomagban?
- `public/` – a weboldal (főoldal, feltöltő oldal: `/feltoltes`, adatkezelési tájékoztató)
- `netlify/functions/` – a foglalási naptár és a galéria háttérrendszere (Netlify Functions + Netlify Blobs)
- `netlify/lib/config.mjs` – **itt lehet módosítani** a szakembereket, szolgáltatásokat, időtartamokat és a munkaidőt

## Telepítés GitHubon keresztül (ajánlott)
1. Hozz létre egy ingyenes fiókot a github.com-on, majd egy új, privát repository-t (pl. `byp-studio`).
2. A repository oldalán: **Add file → Upload files**. Húzd be a kicsomagolt mappa teljes tartalmát (a `public`, `netlify` mappát, a `netlify.toml`, `package.json`, `package-lock.json` fájlokat). **Commit changes**.
3. A Netlify-on (app.netlify.com): **Add new site → Import an existing project → GitHub**, válaszd ki a repository-t, majd **Deploy**. A beállításokat nem kell módosítani, a `netlify.toml` mindent tartalmaz.
4. **Site configuration → Environment variables → Add a variable**: név `ADMIN_PASSWORD`, érték: a kezelőfelület jelszava. Utána **Deploys → Trigger deploy → Deploy site**.
5. Ha e-mailt szeretnél kapni új foglalásról, vendégkönyv-bejegyzésről vagy visszajelzésről: **Project configuration → Forms → Enable form detection**, utána egy újabb deploy, majd **Forms → Form notifications → Add notification → Email notification**. Űrlaponként külön állítható: `foglalas`, `vendegkonyv`, `visszajelzes`.
6. Az oldal neve átírható: **Site configuration → Change site name** (pl. `byp-studio-szalon` → byp-studio-szalon.netlify.app).

## Telepítés parancssorból (ha van Node.js a gépen)
```
npm install
npx netlify-cli login
npx netlify-cli deploy --prod
npx netlify-cli env:set ADMIN_PASSWORD "a-jelszo"
npx netlify-cli deploy --prod
```
(A drag-and-drop feltöltés nem jó, mert az nem telepíti a foglalási rendszert.)

## Oldalak
- Főoldal: `/` (rólunk, szolgáltatások, visszajelzés, kapcsolat)
- Galéria: `/galeria/`
- Vendégkönyv: `/vendegkonyv/`
- Időpontfoglalás: `/foglalas/` (egy szakember előre kiválasztva: `/foglalas/?szakember=petra`)
- A közös fejléc és lábléc a `tools/src/full.html` fájlból készül a `python3 tools/build_pages.py` paranccsal.

## Használat
- Kezelőfelület: `https://<oldal-neve>.netlify.app/feltoltes/` – galéria, foglalások, szabadság, vendégkönyv (jóváhagyás, válasz), visszajelzések
- Az új vendégkönyv-bejegyzések csak jóváhagyás után jelennek meg.

## Frissítés (ha már fent van az oldal)
A GitHub repositoryban **Add file → Upload files**, húzd be újra a kicsomagolt mappa teljes tartalmát, majd **Commit changes**. A Netlify pár perc alatt magától frissíti az oldalt.
- A foglalásokat 30 nap után a rendszer automatikusan törli.
- A háttérképek a `tools/gen_bg.py` szkripttel készültek; saját fotóra cserélhetők a `public/assets/img` mappában.
