// Dispatch: the PBPD radio chatter and the crime label the HUD shows. The
// dispatch panel itself reads live rows from the Police system; this module
// owns the flavour — crime names and the dispatcher's lines.

import { HELI_CALLSIGN } from './config.js';
import { pick } from './random.js';

export const CRIMES = {
  theft: 'GRAND THEFT AUTO',
  assault: 'ASSAULT',
  shooting: 'SHOTS FIRED',
  speeding: 'RECKLESS DRIVING',
  mission: 'ARMED ROBBERY',
  evading: 'FLEEING POLICE',
};

const CHATTER = [
  'All units, suspect is moving fast. Keep the pressure on.',
  'Air support has the light. Ground units, close the net.',
  'Suspect is armed. Approach with caution.',
  'Set a roadblock on the boulevard. Do not let them through.',
  'We have eyes on the suspect vehicle. All units respond.',
  'Suspect is on foot. Move in and make the arrest.',
];

export class Dispatch {
  constructor(rng) {
    this.rng = rng;
    this.crime = CRIMES.theft;
    this.lastChatter = 0;
  }

  setCrime(key) {
    this.crime = CRIMES[key] || CRIMES.theft;
  }

  // A dispatcher line every ~20s while wanted, for the dialogue box.
  chatter(time) {
    if (time - this.lastChatter < 20) return null;
    this.lastChatter = time;
    return pick(this.rng, CHATTER);
  }

  heliLine() {
    return `${HELI_CALLSIGN} has the light. Suspect is in the open.`;
  }
}
