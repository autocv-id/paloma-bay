// The story of Paloma Bay: ten jobs for Kade, from first wheels to the fall
// of the Sunset Keys crew. Every mission is data — the engine in missions.js
// reads these stages. All characters, places and events are invented.

export const MISSIONS = [
  {
    id: 'first-wheels', num: 1, title: 'FIRST WHEELS', giver: 'iris',
    intro: [
      'New in town, Kade? Everyone starts the same way here: on foot.',
      'Borrow a car — any car — and bring it to my garage on Harbor Lights Ave. No questions asked.',
    ],
    outro: 'Clean. You drive like you mean it. I have more work when you want it.',
    stages: [
      { type: 'goto', x: 140, z: -140, r: 14, text: 'Get to the garage on Harbor Lights Ave', next: 'Steal a car' },
      { type: 'enterCar', text: 'Steal a car — any car will do', next: 'Drive it to the garage' },
      { type: 'deliver', x: 140, z: -140, r: 14, text: 'Deliver the car to the garage', next: 'Job done' },
    ],
    reward: { money: 800, rp: 300 },
  },
  {
    id: 'repo-run', num: 2, title: 'REPO RUN', giver: 'berto',
    intro: [
      'Some joker stopped paying for his Sloop Sedan. It is parked in Coral Heights.',
      'Take it back to my lot in the Foundry. The owner might call the cops. Drive like it.',
    ],
    outro: 'The sedan is mine again. You handle heat well, kid.',
    stages: [
      { type: 'goto', x: 0, z: 0, r: 16, text: 'Find the Sloop Sedan in Coral Heights', next: 'Take the car' },
      { type: 'enterCar', carId: 'sloop-sedan', x: 0, z: 0, text: 'Take the repo car', next: 'Lose the heat, then deliver' },
      { type: 'deliver', x: -160, z: 160, r: 14, text: 'Deliver the car to the Foundry lot', next: 'Job done', wanted: 1 },
    ],
    reward: { money: 1200, rp: 450 },
  },
  {
    id: 'harbor-lights', num: 3, title: 'HARBOR LIGHTS', giver: 'iris',
    intro: [
      'A friend of mine docks at Old Harbor tonight. Pick up the package — no, do not open it.',
      'Bring it to the marina. Quiet streets, no sirens. That is the whole job.',
    ],
    outro: 'The package is safe. You are becoming someone people call.',
    stages: [
      { type: 'goto', x: -160, z: -160, r: 14, text: 'Meet the contact at Old Harbor', next: 'Take the package to the marina', night: true },
      { type: 'goto', x: 140, z: -140, r: 14, text: 'Deliver the package to Marina Row', next: 'Job done' },
    ],
    reward: { money: 1000, rp: 400 },
  },
  {
    id: 'the-long-way', num: 4, title: 'THE LONG WAY', giver: 'nadia',
    intro: [
      'A client in Marina Row pays double if the delivery lands in two and a half minutes.',
      'Two and a half minutes, Kade. From the Foundry. The clock is already running.',
    ],
    outro: 'Ninety seconds to spare. The client is impressed. So am I.',
    stages: [
      { type: 'deliver', x: 140, z: -140, r: 14, text: 'Deliver the package to Marina Row', next: 'Beat the clock', timer: 150 },
    ],
    reward: { money: 1500, rp: 600 },
  },
  {
    id: 'roadblock-runner', num: 5, title: 'ROADBLOCK RUNNER', giver: 'iris',
    intro: [
      'The PBPD set up roadblocks all over the south side. Someone talked.',
      'Get through them and reach Sunset Keys. Three stars is nothing — drive like it is.',
    ],
    outro: 'You went through their roadblock like it was made of paper. It nearly was.',
    stages: [
      { type: 'survive', timer: 45, text: 'Survive the heat — 3 stars', next: 'Break through to Sunset Keys', wanted: 3 },
      { type: 'goto', x: 140, z: 160, r: 16, text: 'Reach the safehouse in Sunset Keys', next: 'Job done' },
    ],
    reward: { money: 2000, rp: 800 },
  },
  {
    id: 'wreck-the-marlin', num: 6, title: 'WRECK THE MARLIN', giver: 'iris',
    intro: [
      'Volkov has a Marlin SS he loves more than his own crew. It is cruising Coral Heights.',
      'Wreck it. Total it. Send him the message in twisted metal.',
    ],
    outro: 'Volkov is screaming into every phone in the city. Music to my ears.',
    stages: [
      { type: 'goto', x: 0, z: 0, r: 20, text: 'Find the Marlin SS in Coral Heights', next: 'Wreck it' },
      { type: 'ram', carId: 'marlin-ss', x: 0, z: 0, text: 'Wreck the Marlin SS', next: 'Leave nothing but smoke', damageTo: 0 },
      { type: 'loseCops', text: 'Lose the heat', next: 'Job done' },
    ],
    reward: { money: 2500, rp: 1000 },
  },
  {
    id: 'air-support', num: 7, title: 'AIR SUPPORT', giver: 'nadia',
    intro: [
      'Four stars, Kade. Skyhook-1 is up and it has the light on you.',
      'Stay out of the spotlight, break line of sight, and do not stop moving.',
    ],
    outro: 'You outran a helicopter. The whole city will hear about that one.',
    stages: [
      { type: 'loseCops', text: 'Lose the 4-star heat — helicopter overhead', next: 'Stay out of the light', wanted: 4 },
      { type: 'goto', x: 0, z: -180, r: 16, text: 'Reach the Larkspur Hills hideout', next: 'Job done' },
    ],
    reward: { money: 3000, rp: 1200 },
  },
  {
    id: 'the-exchange', num: 8, title: 'THE EXCHANGE', giver: 'nadia',
    intro: [
      'The exchange in the Foundry is a setup. Volkov sent two cars to end it.',
      'Destroy both cars, then get out. Your fists will not be enough — use the car.',
    ],
    outro: 'Two cars down, and you walked away. Volkov is running out of cars.',
    stages: [
      { type: 'goto', x: -160, z: 160, r: 16, text: 'Get to the Foundry exchange', next: 'They are coming for you' },
      { type: 'destroy', count: 2, carId: 'harbor-cruiser', x: -160, z: 160, text: 'Destroy the 2 rival cars', next: 'Get clear' },
      { type: 'goto', x: 196, z: 0, r: 18, text: 'Escape to Paloma Strand', next: 'Job done' },
    ],
    reward: { money: 3500, rp: 1400 },
  },
  {
    id: 'causeway-convoy', num: 9, title: 'CAUSEWAY CONVOY', giver: 'berto',
    intro: [
      'Volkov moves money down the causeway every Friday. Two cars, one package.',
      'Hit the convoy, take the package, and bring it to my lot. Fast.',
    ],
    outro: 'The package is ours. Volkov just funded our whole month.',
    stages: [
      { type: 'goto', x: 0, z: 210, r: 18, text: 'Intercept the convoy on the Causeway', next: 'Hit both cars' },
      { type: 'destroy', count: 2, carId: 'pelican-van', x: 0, z: 210, text: 'Stop the 2 convoy cars', next: 'Grab the package' },
      { type: 'deliver', x: -160, z: 160, r: 14, text: 'Deliver the package to the Foundry lot', next: 'Job done', wanted: 2 },
    ],
    reward: { money: 4000, rp: 1600 },
  },
  {
    id: 'kingpins-fall', num: 10, title: "KINGPIN'S FALL", giver: 'iris',
    intro: [
      'This is it, Kade. Volkov himself is in Sunset Keys, in the gold Marlin.',
      'Wreck his car, lose the whole PBPD, and bring me his ledger. Then Paloma Bay is ours.',
    ],
    outro: 'Volkov is done. Paloma Bay has a new name on the street — yours.',
    stages: [
      { type: 'goto', x: 140, z: 160, r: 18, text: 'Find Volkov in Sunset Keys', next: 'End it' },
      { type: 'ram', carId: 'marlin-ss', x: 140, z: 160, text: "Wreck Volkov's gold Marlin", next: 'Now run', damageTo: 0 },
      { type: 'loseCops', text: 'Lose the 5-star heat', next: 'One last drive', wanted: 5 },
      { type: 'deliver', x: 140, z: -140, r: 14, text: 'Deliver the ledger to Marina Row', next: 'Paloma Bay is yours' },
    ],
    reward: { money: 8000, rp: 2500 },
  },
];

export function nextMission(doneIds) {
  return MISSIONS.find((m) => !doneIds.includes(m.id)) || null;
}
