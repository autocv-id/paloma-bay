// Dispatch: the PBPD radio chatter — a dispatcher line every ~20s while
// wanted, shown in the dialogue box. The dispatch panel itself reads live
// rows from the Police system.

import { pick } from './random.js';

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
    this.lastChatter = 0;
  }

  // A dispatcher line every ~20s while wanted, for the dialogue box.
  chatter(time) {
    if (time - this.lastChatter < 20) return null;
    this.lastChatter = time;
    return pick(this.rng, CHATTER);
  }
}
