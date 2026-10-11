// A szalon adatai: szakemberek, szolgáltatások (időtartam percben) és munkaidő.
// Ezt a fájlt kell szerkeszteni, ha változik a szolgáltatás, az időtartam vagy a munkaidő.

export const SALON = {
  name: 'BYP Stúdió',
  timeZone: 'Europe/Budapest',
  stepMinutes: 30,      // ilyen lépésközzel kínálunk kezdési időpontokat
  daysAhead: 30,        // ennyi napra előre lehet foglalni
  minLeadMinutes: 60,   // legalább ennyivel előbb kell foglalni
};

// Munkaidő a hét napjai szerint (0 = vasárnap). Hiányzó nap = zárva.
const DEFAULT_HOURS = { 1: ['09:00', '18:00'], 2: ['09:00', '18:00'], 3: ['09:00', '18:00'], 4: ['09:00', '18:00'], 5: ['09:00', '18:00'], 6: ['09:00', '13:00'] };

export const LENGTHS = [{ id: 'rovid', name: 'Rövid' }, { id: 'felhosszu', name: 'Félhosszú' }, { id: 'hosszu', name: 'Hosszú' }];

export const SPECIALISTS = [
  {
    id: 'petra', name: 'Borbély Petra', role: 'Fodrász', icon: 'scissors', phone: '+36 70 788 8935',
    hours: DEFAULT_HOURS,
    // Fodrász árlista (érvényes: 2026. január 24-től). Árak forintban, bruttó szalonárak.
    // prices: [rövid, félhosszú, hosszú] – null = nem elérhető. price: egy ár. priceText: szöveges ár.
    // dur: időtartam percben (a naptár ennyi időt foglal le) – szükség szerint módosítható.
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
            { id: 'noi-festes', name: 'Festés (60 g festékig) + festék 60 Ft/g', dur: 120, prices: [10500, 13500, 17500] },
            { id: 'noi-tofestes', name: 'Tőfestés', dur: 90, prices: [6500, 8500, 10500] },
            { id: 'noi-folias', name: 'Fóliás melír', dur: 150, prices: [null, 18500, 20500] },
            { id: 'noi-sapkas', name: 'Sapkás melír', dur: 120, prices: [13500, 18500, 21500] },
            { id: 'noi-balayage', name: 'Balayage / ombre', dur: 180, prices: [null, 25000, 30000] },
            { id: 'noi-szokites', name: 'Szőkítés', dur: 120, prices: [6500, 9000, 13500] },
            { id: 'noi-toszokites', name: 'Tő szőkítés', dur: 90, prices: [4500, 5500, 5500] },
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
    services: [
      { id: 'kez', name: 'Kézápolás', dur: 45 },
      { id: 'mukorom', name: 'Műköröm építés', dur: 120 },
      { id: 'pedikur', name: 'Esztétikai pedikűr', dur: 60 },
    ],
  },
  {
    id: 'andrea', name: 'Löki Andrea', role: 'Szempilla és fülbelövés', icon: 'lash', phone: '+36 30 608 2304',
    // Időpont-egyeztetés Messengeren (online naptár helyett): https://m.me/<felhasználónév>
    booking: 'messenger', messenger: 'https://m.me/ancsii23',
    hours: DEFAULT_HOURS,
    services: [
      { id: 'szempilla', name: 'Szempilla-hosszabbítás', dur: 120 },
      { id: 'fulbelo', name: 'Fülbelövés', dur: 30 },
    ],
  },
  {
    id: 'viktoria', name: 'Német-Kotyuga Viktória', short: 'Kotyuga Viktória', role: 'Zselés és műköröm', icon: 'polish', phone: '+36 30 845 4499',
    booking: 'messenger', messenger: 'https://m.me/viktoria.kotyuga',
    hours: DEFAULT_HOURS,
    services: [
      { id: 'kez', name: 'Kézápolás', dur: 45 },
      { id: 'zsele', name: 'Zselés lakkozás', dur: 60 },
      { id: 'mukorom', name: 'Műköröm építés', dur: 120 },
    ],
  },
];

// Ahol kategóriás árlista van, a szolgáltatások lapos listája abból készül (a foglalás ezt használja).
for (const sp of SPECIALISTS) {
  if (!sp.categories) continue;
  sp.services = sp.categories.flatMap(c => c.groups.flatMap(g => g.services.map(v => ({ ...v, cat: c.id, catName: c.name, group: g.name }))));
}
