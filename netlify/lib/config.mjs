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

export const SPECIALISTS = [
  {
    id: 'petra', name: 'Borbély Petra', role: 'Fodrász', icon: 'scissors', phone: '+36 70 788 8935',
    hours: DEFAULT_HOURS,
    services: [
      { id: 'noi', name: 'Női hajvágás és styling', dur: 60 },
      { id: 'ferfi', name: 'Férfi hajvágás', dur: 30 },
      { id: 'gyerek', name: 'Gyermek hajvágás', dur: 30 },
      { id: 'tanacs', name: 'Stílus- és formatanácsadás', dur: 30 },
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
    hours: DEFAULT_HOURS,
    services: [
      { id: 'szempilla', name: 'Szempilla-hosszabbítás', dur: 120 },
      { id: 'fulbelo', name: 'Fülbelövés', dur: 30 },
    ],
  },
  {
    id: 'viktoria', name: 'Német-Kotyuga Viktória', short: 'Kotyuga Viktória', role: 'Zselés és műköröm', icon: 'polish', phone: '+36 30 845 4499',
    hours: DEFAULT_HOURS,
    services: [
      { id: 'kez', name: 'Kézápolás', dur: 45 },
      { id: 'zsele', name: 'Zselés lakkozás', dur: 60 },
      { id: 'mukorom', name: 'Műköröm építés', dur: 120 },
    ],
  },
];
