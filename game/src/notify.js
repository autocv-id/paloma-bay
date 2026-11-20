// Notify: the tiny helpers every system uses to talk to the player —
// dialogue lines, big banners, toasts and location cards. Kept in its own
// module so systems never import the whole UI layer.

import { G } from './state.js';

export function say(npcKey, lines) {
  G.dialogue = { npc: npcKey, lines: Array.isArray(lines) ? lines : [lines], index: 0 };
}
export function advanceDialogue() {
  if (!G.dialogue) return false;
  G.dialogue.index++;
  if (G.dialogue.index >= G.dialogue.lines.length) G.dialogue = null;
  return true;
}
export function banner(text, sub, seconds = 4) {
  G.banner = { text, sub: sub || '', until: G.time + seconds };
}
export function notice(text) {
  G.notice = { text, until: G.time + 3.5 };
}
export function locationBanner(district) {
  G.location = district;
  G.locationUntil = G.time + 3.2;
}
