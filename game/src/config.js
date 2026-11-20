// PALOMA BAY — configuration, tuning and every original name in the game.
// All names, places, people, cars, stations and gangs are invented for this
// game. Nothing here comes from any commercial game, film or real place.

export const CITY_NAME = 'Paloma Bay';
export const POLICE_NAME = 'PBPD';
export const POLICE_FULL = 'Paloma Bay Police Department';

// ---- world layout (metres) ----
export const BLOCK = 44; // city block size
export const ROAD = 12; // road width
export const PITCH = BLOCK + ROAD; // street spacing
export const GRID = 9; // streets per axis
export const CITY_EDGE = 236; // half-width of the built city
export const BEACH_X = 244; // sand starts here
export const OCEAN_X = 330; // water starts here
export const WORLD_EDGE = 420; // playable bounds (square)

// Street centre lines, both axes.
export const STREETS = [-224, -168, -112, -56, 0, 56, 112, 168, 224];

// ---- districts (name, bounds, standing 0..100, flavour) ----
export const DISTRICTS = [
  { name: 'Paloma Strand', street: 'Paloma Boulevard', x0: 168, x1: 244, z0: -224, z1: 224, standing: 58 },
  { name: 'Marina Row', street: 'Harbor Lights Ave', x0: 56, x1: 168, z0: -224, z1: -56, standing: 41 },
  { name: 'Old Harbor', street: 'Cannery Row', x0: -224, x1: -56, z0: -224, z1: -56, standing: 33 },
  { name: 'Coral Heights', street: 'Coral Heights Blvd', x0: -56, x1: 56, z0: -112, z1: 112, standing: 50 },
  { name: 'Foundry District', street: 'Furnace Street', x0: -224, x1: -56, z0: 56, z1: 224, standing: 22 },
  { name: 'Sunset Keys', street: 'Sunset Keys Drive', x0: 56, x1: 168, z0: 56, z1: 224, standing: 47 },
  { name: 'Larkspur Hills', street: 'Larkspur Rise', x0: -56, x1: 56, z0: -224, z1: -112, standing: 64 },
  { name: 'The Causeway', street: 'Causeway South', x0: -224, x1: 224, z0: 196, z1: 244, standing: 38 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return DISTRICTS[3];
}

// ---- people (all invented) ----
export const PLAYER_NAME = 'Kade';
export const NPCS = {
  iris: { name: 'Iris Delgado', role: 'FIXER · MARINA ROW', color: '#e078a8', initial: 'ID' },
  berto: { name: "Berto 'Wrench' Acosta", role: 'MECHANIC · FOUNDRY', color: '#e0a458', initial: 'BA' },
  nadia: { name: 'Nadia Cole', role: 'LOOKOUT · CORAL HEIGHTS', color: '#7ac8e0', initial: 'NC' },
  okafor: { name: 'Capt. Okafor', role: 'PBPD DISPATCH', color: '#8fa8c8', initial: 'CO' },
  volkov: { name: "Dmitri 'Dune' Volkov", role: 'RIVAL CREW · SUNSET KEYS', color: '#b08ae0', initial: 'DV' },
  rae: { name: 'Rae Delgado', role: 'DRIVER · CREW', color: '#7ad8a0', initial: 'RD' },
  zara: { name: 'Zara Quinn', role: 'WHEELWOMAN · PALOMA STRAND', color: '#e07878', initial: 'ZQ' },
};

// ---- cars (all invented models) ----
export const CARS = [
  { id: 'paloma-gt', name: 'Paloma GT', kind: 'SPORTS', top: 62, accel: 26, grip: 1.0, price: 12000, colors: [0xff7a4d, 0x4dc8ff, 0xffd24d] },
  { id: 'caspian-s', name: 'Caspian S', kind: 'SPORTS · TUNE 2', top: 58, accel: 24, grip: 0.95, price: 9000, colors: [0xe04d5a, 0x58e0a0, 0xf0f0f0] },
  { id: 'tern-coupe', name: 'Tern Coupe', kind: 'COUPE', top: 52, accel: 21, grip: 0.9, price: 6500, colors: [0x4d7aff, 0xc0c8d0, 0x9030e0] },
  { id: 'sloop-sedan', name: 'Sloop Sedan', kind: 'SEDAN', top: 44, accel: 16, grip: 0.85, price: 3200, colors: [0x90a0b0, 0x305060, 0xd8d0c0] },
  { id: 'harbor-cruiser', name: 'Harbor Cruiser', kind: 'MUSCLE', top: 50, accel: 20, grip: 0.8, price: 7800, colors: [0x20242c, 0x802020, 0x205080] },
  { id: 'sandpiper', name: 'Sandpiper Dune', kind: 'OFF-ROAD', top: 46, accel: 18, grip: 1.05, price: 5400, colors: [0xd8c040, 0x40a080, 0xc07840] },
  { id: 'pelican-van', name: 'Pelican Van', kind: 'VAN', top: 38, accel: 13, grip: 0.75, price: 4100, colors: [0xe8e8e8, 0x6080a0, 0xa08050] },
  { id: 'egret-coupe', name: 'Egret Coupe', kind: 'COUPE', top: 55, accel: 22, grip: 0.92, price: 7200, colors: [0xf0e0e0, 0x30c8c8, 0x303030] },
  { id: 'marlin-ss', name: 'Marlin SS', kind: 'SUPER', top: 68, accel: 30, grip: 1.05, price: 22000, colors: [0xff3040, 0x101418, 0xffc030] },
];
export function carById(id) { return CARS.find((c) => c.id === id) || CARS[0]; }

// ---- police ----
export const POLICE_UNITS = [
  'PELICAN-12', 'EGRET-7', 'IBIS-3', 'KESTREL-9', 'FALCON-4', 'MERLIN-2',
  'GULL-21', 'TERN-8', 'OSPREY-6', 'HARRIER-5', 'CONDOR-2', 'SWIFT-11',
];
export const HELI_CALLSIGN = 'SKYHOOK-1';
export const TACTICS = ['PURSUE', 'RAM', 'PIT', 'FLANK', 'ROADBLOCK', 'SPOTLIGHT'];

// ---- progression ----
export const RANKS = [
  { name: 'ROOKIE', rp: 0 },
  { name: 'RUNNER', rp: 800 },
  { name: 'HUSTLER', rp: 2000 },
  { name: 'FIXER', rp: 3800 },
  { name: 'BIG SHOT', rp: 6200 },
  { name: 'KINGPIN', rp: 9500 },
];
export function rankFor(rp) {
  let r = 0;
  for (let i = 0; i < RANKS.length; i++) if (rp >= RANKS[i].rp) r = i;
  return r;
}

// ---- weapons (id, name, slot, damage, fire rate, mag, locked until rank) ----
export const WEAPONS = [
  { id: 'fists', name: 'FISTS', damage: 12, rate: 2.5, mag: Infinity, auto: false, minRank: 0 },
  { id: 'p9', name: 'P9', damage: 22, rate: 4, mag: 96, auto: false, minRank: 0 },
  { id: 'swift', name: 'SWIFT SMG', damage: 16, rate: 10, mag: 240, auto: true, minRank: 1 },
  { id: 'mule', name: 'MULE 12G', damage: 55, rate: 1.4, mag: 40, auto: false, minRank: 2 },
  { id: 'longshore', name: 'LONGSHORE AR', damage: 30, rate: 8, mag: 210, auto: true, minRank: 3 },
  { id: 'harpoon', name: 'HARPOON RPG', damage: 220, rate: 0.7, mag: 8, auto: false, minRank: 4 },
];

// ---- crew abilities (key, name, member, cooldown seconds, effect) ----
export const CREW = [
  { key: 'Z', id: 'swap', name: 'SWAP PLATES', member: 'Rae · Driver', cd: 45, desc: 'Wanted level drops by 2 stars' },
  { key: 'X', id: 'fix', name: 'QUICK FIX', member: 'Berto · Mechanic', cd: 60, desc: 'Repairs your car to full condition' },
  { key: 'C', id: 'eyes', name: 'EYES OUT', member: 'Nadia · Lookout', cd: 50, desc: 'Police shown on the minimap for 25s' },
];

// ---- radio stations (procedural music, all original) ----
export const RADIO = [
  { name: 'PALOMA FM 101.5', song: 'Golden Hour', artist: 'The Breakers', scale: [0, 2, 4, 7, 9], bpm: 112, root: 220 },
  { name: 'RADIO CORAL 88.2', song: 'Salt Air Drive', artist: 'Mira Sol', scale: [0, 3, 5, 7, 10], bpm: 96, root: 196 },
  { name: 'KEYS 97.7', song: 'Night Tide', artist: 'Low Orbit', scale: [0, 2, 3, 7, 8], bpm: 124, root: 233 },
];

// ---- wanted tuning ----
export const WANTED = {
  maxUnits: [0, 2, 3, 4, 5, 6], // police cars by star level
  heliAt: 4, // stars when the helicopter arrives
  roadblockAt: 3, // stars when roadblocks appear
  evadeSeconds: 14, // unseen time before a star drops
  bustSeconds: 3, // standing still near police while wanted
};

// ---- tuning ----
export const TUNE = {
  walkSpeed: 9,
  runSpeed: 14,
  carEnterRange: 6,
  cameraDistance: 9, // chase-cam distance (m); closer = the car reads bigger
  cameraHeight: 3.0, // chase-cam height above the target (low = more sky in frame)
  dayLengthMin: 24, // real minutes per game day
  startHour: 17.4, // golden hour
  startMoney: 2500,
  startRp: 0,
  gravity: 30,
};
