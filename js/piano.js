const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };
const NW = 14;

export const KEYBOARD_MAP = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72 };

export class OnscreenPiano {
  constructor(container, { onNoteOn, onNoteOff }) {
    this.container = container;
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
    this.keyEls = {};
    this.down = new Map();
    this.build();
    this.bindPointer();
    this.bindKeys();
  }

  build() {
    for (let o = 0; o < 2; o++) {
      for (let k = 0; k < 7; k++) {
        const m = 60 + o * 12 + WHITE[k];
        const e = document.createElement('div');
        e.className = 'w';
        e.dataset.m = m;
        this.container.appendChild(e);
        this.keyEls[m] = e;
      }
    }
    for (let o = 0; o < 2; o++) {
      for (const pc in BLACK) {
        const m = 60 + o * 12 + +pc;
        const e = document.createElement('div');
        e.className = 'b';
        e.dataset.m = m;
        e.style.left = ((o * 7 + BLACK[pc] + 1) / NW * 100) + '%';
        this.container.appendChild(e);
        this.keyEls[m] = e;
      }
    }
  }

  bindPointer() {
    this.container.addEventListener('pointerdown', e => {
      const t = e.target.closest('[data-m]');
      if (!t) return;
      e.preventDefault();
      const m = +t.dataset.m;
      this.down.set(e.pointerId, m);
      this.onNoteOn(m, 90);
    });
    const up = e => {
      if (this.down.has(e.pointerId)) {
        this.onNoteOff(this.down.get(e.pointerId));
        this.down.delete(e.pointerId);
      }
    };
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => this.container.addEventListener(n, up));
  }

  bindKeys() {
    addEventListener('keydown', e => {
      if (e.repeat || e.metaKey || e.ctrlKey) return;
      const m = KEYBOARD_MAP[e.key.toLowerCase()];
      if (m !== undefined) this.onNoteOn(m, 90);
    });
    addEventListener('keyup', e => {
      const m = KEYBOARD_MAP[e.key.toLowerCase()];
      if (m !== undefined) this.onNoteOff(m);
    });
  }

  paint(soundingMidis) {
    for (const m in this.keyEls) {
      this.keyEls[m].classList.toggle('on', soundingMidis.includes(+m));
    }
  }
}
