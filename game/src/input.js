// Input: keyboard + mouse, with an edge-triggered "pressed" set so menus
// and one-shot actions (enter car, shoot, abilities) fire exactly once per
// key press. The self-test drives the same state programmatically.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mousePressed = false;
    this.lookDX = 0;
    this.enabled = true;
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); });
    window.addEventListener('mousemove', (e) => {
      this.lookDX += e.movementX || 0;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mousePressed = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
  }

  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  consume(code) { this.pressed.delete(code); }

  // Test harness: pretend a key was pressed this frame.
  fakePress(code) { this.pressed.add(code); this.keys.add(code); }
  fakeRelease(code) { this.keys.delete(code); }
  fakeMouse() { this.mousePressed = true; this.mouseDown = true; }

  // Movement axes in camera space: forward/strafe -1..1.
  moveAxes() {
    let f = 0, s = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) f += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) f -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) s -= 1;
    return { f, s };
  }

  endFrame() {
    this.pressed.clear();
    this.mousePressed = false;
    this.lookDX = 0;
  }
}
