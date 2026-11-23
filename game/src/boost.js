// Nitro boost: hold SHIFT while driving for +40% top speed. The meter
// drains while boosting and refills while cruising; an empty meter means
// no boost until it recovers. The speedometer shows the meter.

import { G } from './state.js';

export const BOOST_TOP_MULT = 1.4;
export const BOOST_DRAIN = 22; // meter per second while boosting
export const BOOST_REFILL = 9; // meter per second while not boosting

// Advance the meter one step. Returns true while the boost is live.
export function tickBoost(dt, wantBoost) {
  G.boosting = wantBoost && !G.onFoot && !!G.car && G.boost > 0;
  if (G.boosting) G.boost = Math.max(0, G.boost - BOOST_DRAIN * dt);
  else G.boost = Math.min(100, G.boost + BOOST_REFILL * dt);
  return G.boosting;
}

// Top-speed multiplier for the current step (1 when not boosting).
export function boostTopMult() {
  return G.boosting ? BOOST_TOP_MULT : 1;
}
