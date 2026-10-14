// A szalon adatai: szakemberek, szolgáltatások (időtartam percben) és munkaidő.
// Ezt a fájlt kell szerkeszteni, ha változik a szolgáltatás, az időtartam vagy a munkaidő.

export const SALON = {
  name: 'BYP Stúdió',
  timeZone: 'Europe/Budapest',
  stepMinutes: 30,      // ilyen lépésközzel kínálunk kezdési időpontokat
  daysAhead: 365,       // ennyi napra előre lehet foglalni (1 év)
  minLeadMinutes: 60,   // legalább ennyivel előbb kell foglalni
};

// Munkaidő a hét napjai szerint (0 = vasárnap). Hiányzó nap = zárva.
const DEFAULT_HOURS = { 1: ['09:00', '18:00'], 2: ['09:00', '18:00'], 3: ['09:00', '18:00'], 4: ['09:00', '18:00'], 5: ['09:00', '18:00'], 6: ['09:00', '13:00'] };

export const LENGTHS = [{ id: 'rovid', name: 'Rövid' }, { id: 'felhosszu', name: 'Félhosszú' }, { id: 'hosszu', name: 'Hosszú' }];

export const SPECIALISTS = [
  {
    id: 'petra', name: 'Borbély Petra', role: 'Fodrász', icon: 'scissors', phone: '+36 70 788 8935',
    plTitle: 'Fodrászat', plIntro: 'Női, férfi és gyerek hajvágás, festés, melír, hajhosszabbítás és hajápolás',
    hours: DEFAULT_HOURS,
    // Fodrász árlista (érvényes: 2026. január 24-től). Árak forintban, bruttó szalonárak.
    // prices: [rövid, félhosszú, hosszú] – null = nem elérhető. price: egy ár. priceText: szöveges ár.
    // dur: időtartam percben (a naptár ennyi időt foglal le) – szükség szerint módosítható.
    // pause: [tól, ig] perc a szolgáltatás kezdetétől = hatóidő (festés, melír, szőkítés, balayage).
    // A hatóidőbe a 30–45 perces szolgáltatások foglalhatók (automatikus; egyedileg 'pauseOk: true/false'-szal felülírható).
    priceNotes: [
      'A végső ár a felhasznált anyagmennyiségtől függ.',
      'Plusz anyagköltség: 60 Ft/gramm.',
      'A feltüntetett árak forintban értendő bruttó szalonárak.',
      'Érvényes: 2026. január 24-től.',
    ],
    categories: [
      {
        id: 'noi', name: 'Női', icon: 'scissors',
        groups: [
          { name: 'Vágás, festés, styling', lengths: true, services: [
            { id: 'noi-szaraz', name: 'Női száraz hajvágás', dur: 30, prices: [4500, 5000, 5500] },
            { id: 'noi-mosas-szaritas', name: 'Mosás + szárítás', dur: 45, prices: [5000, 6000, 7000] },
            { id: 'noi-mvsz', name: 'Mosás + vágás + szárítás', dur: 60, prices: [7000, 8000, 9000] },
            { id: 'noi-festes', name: 'Festés (60 g festékig) + festék 60 Ft/g', dur: 120, pause: [30, 75], prices: [10500, 13500, 17500] },
            { id: 'noi-tofestes', name: 'Tőfestés', dur: 90, pause: [30, 75], prices: [6500, 8500, 10500] },
            { id: 'noi-folias', name: 'Fóliás melír', dur: 150, pause: [30, 75], prices: [null, 18500, 20500] },
            { id: 'noi-sapkas', name: 'Sapkás melír', dur: 120, pause: [30, 75], prices: [13500, 18500, 21500] },
            { id: 'noi-balayage', name: 'Balayage / ombre', dur: 180, pause: [30, 75], prices: [null, 25000, 30000] },
            { id: 'noi-szokites', name: 'Szőkítés', dur: 120, pause: [30, 75], prices: [6500, 9000, 13500] },
            { id: 'noi-toszokites', name: 'Tő szőkítés', dur: 90, pause: [30, 75], prices: [4500, 5500, 5500] },
            { id: 'noi-alkalmi', name: 'Alkalmi frizura', dur: 60, prices: [11500, 16500, 20500] },
            { id: 'noi-vasalas', name: 'Hajvasalás', dur: 30, prices: [null, 3500, 4000] },
            { id: 'noi-sutes', name: 'Hajsütés', dur: 45, prices: [null, 6000, 7000] },
            { id: 'noi-fonas', name: 'Fonás', dur: 30, priceText: '4 500 Ft-tól' },
          ] },
          { name: 'Hajhosszabbítás', services: [
            { id: 'hh-hoillesztes', name: 'Hajhosszabbítás hőillesztéssel', dur: 180, priceText: '27 000 Ft / 100 g' },
            { id: 'hh-mikro', name: 'Hajhosszabbítás mikro- vagy nanogyűrűvel', dur: 180, priceText: '33 000 Ft / 100 g' },
            { id: 'hh-keratin', name: 'Keratinozás', dur: 120, priceText: '12 000 Ft / 100 g' },
            { id: 'hh-leszedes', name: 'Leszedés', dur: 90, priceText: '12 000 Ft / 100 g' },
            { id: 'hh-bontas', name: 'Kócos haj esetén bontás', dur: 60, priceText: '6 000 Ft / óra' },
          ] },
          { name: 'Ápolás', lengths: true, services: [
            { id: 'ap-keratin', name: 'Keratinos hajszerkezet-helyreállító kezelés', dur: 120, prices: [15000, 20000, 25000] },
            { id: 'ap-regeneralo', name: 'Regeneráló kezelés (+ mosás + szárítás)', dur: 60, prices: [2000, 3000, 4000] },
            { id: 'ap-steampod', name: 'Steampod kezelés (+ mosás + szárítás)', dur: 60, prices: [null, 4000, 5000] },
            { id: 'ap-hajveg', name: 'Töredezett hajvég eltávolítás', dur: 60, prices: [null, 5000, 6000] },
          ] },
        ],
      },
      {
        id: 'ferfi', name: 'Férfi', icon: 'scissors',
        groups: [
          { name: 'Férfi', services: [
            { id: 'ferfi-vagas', name: 'Férfi hajvágás', dur: 30, price: 4500 },
          ] },
        ],
      },
      {
        id: 'gyerek', name: 'Gyerek', icon: 'scissors',
        groups: [
          { name: 'Gyerek', lengths: true, services: [
            { id: 'gy-kisfiu', name: 'Kisfiú hajvágás', dur: 30, priceText: '4 000 – 5 500 Ft' },
            { id: 'gy-kislany', name: 'Kislány hajvágás', dur: 30, prices: [4500, 5000, 6000] },
          ] },
        ],
      },
    ],
  },
  {
    id: 'csilla', name: 'Nagyné Kiss Csilla Krisztina', short: 'Kiss Csilla', role: 'Kéz- és lábápolás', icon: 'footprints', phone: '+36 70 317 5667',
    hours: DEFAULT_HOURS,
    // Árlista és foglalás ugyanebből: prices = [S, M, L] méret szerinti árak (a 'lengths' a méretválasztó).
    plTitle: 'Kéz- és lábápolás, műköröm', plIntro: 'Kézápoló és műkörömépítő, esztétikai pedikűrös',
    lengths: [{ id: 's', name: 'S méret' }, { id: 'm', name: 'M méret' }, { id: 'l', name: 'L méret' }],
    lengthQ: 'Melyik méretet kéred?', lengthMissing: 'Válaszd ki a méretet',
    priceNotes: ['A feltüntetett árak forintban értendők.', 'Díszítést (ombre, francia, matrica, strasszkő) helyben is kérhetsz.', 'Köszönöm a bizalmat, várlak sok szeretettel!'],
    categories: [
      {
        id: 'csilla', name: 'Kéz- és lábápolás', hideName: true,
        groups: [
          { name: 'Gél lakk', services: [
            { id: 'gel-sima', name: 'Gél lakk – sima alappal', dur: 90, price: 5000 },
            { id: 'gel-erositett', name: 'Gél lakk – erősített alappal', dur: 90, price: 6000 },
          ] },
          { name: 'Műköröm (zselés, tip vagy sablon technikával)', services: [
            { id: 'mukorom', name: 'Műköröm építés', dur: 150, prices: [7000, 7500, 8000] },
            { id: 'mukorom-toltes', name: 'Műköröm töltés', dur: 120, prices: [6000, 6500, 7000] },
          ] },
          { name: 'Manikűr', services: [
            { id: 'kez', name: 'Klasszikus manikűr', dur: 60, price: 4000 },
            { id: 'japan', name: 'Japán manikűr', dur: 60, price: 5000 },
            { id: 'gepi', name: 'Kombinált / gépi (orosz) manikűr', dur: 60, price: 4000 },
          ] },
          { name: 'Esztétikai pedikűr', services: [
            { id: 'pedikur', name: 'Esztétikai pedikűr', dur: 90, price: 10000 },
            { id: 'pedikur-gel', name: 'Esztétikai pedikűr + gél lakk', dur: 120, price: 13500 },
          ] },
          { name: 'Paraffinos ápolás', services: [
            { id: 'paraffin', name: 'Paraffinos kéz- vagy lábápolás', dur: 60, price: 6000 },
          ] },
          { name: 'Eltávolítás', services: [
            { id: 'gel-levetel', name: 'Gél lakk eltávolítás', dur: 30, price: 3000 },
            { id: 'mukorom-levetel', name: 'Műköröm eltávolítás', dur: 60, price: 4000 },
          ] },
          { name: 'Díszítés', bookable: false, services: [
            { id: 'disz-ombre', name: 'Ombre / francia', dur: 2, priceText: '+200 Ft / db' },
            { id: 'disz-matrica', name: 'Matrica / fólia', dur: 1, priceText: '100 Ft / db' },
            { id: 'disz-strassz', name: 'Strasszkő', dur: 1, priceText: '300 Ft / ujj' },
          ] },
        ],
      },
    ],
  },
  {
    id: 'andrea', name: 'Löki Andrea', role: 'Szempillaépítés, Fülbelövés', icon: 'lash', phone: '+36 30 608 2304',
    // Időpont-egyeztetés Messengeren (online naptár helyett): https://m.me/<felhasználónév>
    booking: 'messenger', messenger: 'https://www.facebook.com/ancsii23',
    hours: DEFAULT_HOURS,
    services: [
      { id: 'szempilla', name: 'Szempillaépítés', dur: 150 },
      { id: 'lifting', name: 'Szempillalifting', dur: 60 },
      { id: 'fulbelo', name: 'Fülbelövés', dur: 15 },
    ],
    priceList: {
      title: 'Szempilla és fülbelövés', intro: 'LAshes by Andi',
      groups: [
        { name: 'Szempillaépítés', wide: true, cols: ['Építés', 'Töltés'], rows: [
          { name: '2D', prices: [12000, 10000] },
          { name: '3D', prices: [12500, 10500] },
          { name: '4D', prices: [13500, 11500] },
          { name: '5D', prices: [14500, 12500] },
          { name: '6D', prices: [15500, 13500] },
        ] },
        { name: 'Szempillalifting', rows: [
          { name: 'Szempillalifting', price: 8000 },
          { name: 'Szempillalifting + festés', price: 9000 },
        ] },
        { name: 'Fülbelövés', rows: [
          { name: 'Fülbelövés', desc: 'Az ár az ékszert is tartalmazza.', priceText: '3 500 Ft / lövés' },
          { name: 'Utókezelő folyadék', desc: '2 vagy több lövés esetén ajándék.', price: 500 },
        ] },
      ],
      notes: [
        'A töltés 4 hétig (a 28. napig) érvényes, ha a szett 30%-a még fent van; egyéb esetben az új szett ára érvényes.',
        'Az árak forintban értendők.',
        'Az árváltozás jogát fenntartom.',
      ],
    },
  },
  {
    id: 'viktoria', name: 'Német-Kotyuga Viktória', short: 'Kotyuga Viktória', role: 'Gél lakk, Műköröm', icon: 'polish', phone: '+36 30 845 4499',
    booking: 'messenger', messenger: 'https://www.facebook.com/viktoria.kotyuga',
    hours: DEFAULT_HOURS,
    services: [
      // durText: a honlapon kiírt időtartam (sáv); dur: a naptárban lefoglalt idő percben
      { id: 'kez', name: 'Kézápolás, manikűr', dur: 60, durText: '30–60 perc' },
      { id: 'zsele', name: 'Modern gél lakk', dur: 120, durText: '1,5–2 óra' },
      { id: 'mukorom', name: 'Műköröm saját körömhosszig', dur: 150, durText: '2–2,5 óra' },
    ],
    priceList: {
      title: 'Gél lakk és műköröm', intro: 'VikNail',
      groups: [
        { name: 'Csomagok', wide: true, cols: ['S méret', 'M méret', 'L méret'], rows: [
          { name: 'Minimalista csomag', desc: 'Csak az alap és a fény van a körmökön.', prices: [7000, 7200, 7500] },
          { name: 'Normál csomag', desc: '1–3 szín + minimális díszítés.', prices: [7500, 7700, 8000] },
          { name: 'Medium csomag', desc: '1–3 körömbe francia, ombre, kövek, porok stb.', prices: [7800, 8000, 8300] },
          { name: 'Extra csomag', desc: 'Full francia, ombre vagy extra díszítés.', prices: [8800, 9000, 9300] },
        ] },
        { name: 'Manikűr', rows: [
          { name: 'Női / férfi manikűr', price: 4500 },
          { name: 'Anyagleszedés + manikűr', price: 5000 },
        ] },
        { name: 'Kiegészítők', rows: [
          { name: 'Körömpótlás', priceText: '800 Ft / db' },
          { name: 'Full köves köröm', priceText: '+1 000 Ft' },
        ] },
      ],
      notes: ['Érvényes: 2026. június 1-től.', 'Az árak forintban értendők.'],
    },
  },
];

// Ahol kategóriás árlista van, a szolgáltatások lapos listája abból készül (a foglalás ezt használja).
for (const sp of SPECIALISTS) {
  if (!sp.categories) continue;
  // a csak árlistás csoportok (bookable: false) a foglalásban nem szerepelnek
  sp.services = sp.categories.flatMap(c => c.groups.filter(g => g.bookable !== false).flatMap(g => g.services.map(v => ({ ...v, cat: c.id, catName: c.hideName ? null : c.name, group: g.name }))));
}
// Hatóidőbe foglalható szolgáltatások: 30–45 percesek (ha nincs külön megadva)
for (const sp of SPECIALISTS) for (const v of sp.services) if (v.pauseOk === undefined) v.pauseOk = !v.pause && v.dur >= 30 && v.dur <= 45;
