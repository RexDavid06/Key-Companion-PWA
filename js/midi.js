export function parseMessage(data) {
  if (!data || data.length < 2) return { type: 'other' };
  const status = data[0];
  const cmd = status & 0xf0;
  const d1 = data[1];
  const d2 = data.length > 2 ? data[2] : 0;
  if (cmd === 0x90 && d2 > 0) return { type: 'noteon', note: d1, velocity: d2, channel: status & 0x0f };
  if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) return { type: 'noteoff', note: d1, channel: status & 0x0f };
  if (cmd === 0xb0) {
    if (d1 === 64) return { type: 'sustain', on: d2 >= 64 };
    return { type: 'cc', cc: d1, value: d2 };
  }
  return { type: 'other' };
}

export class MidiInput {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.access = null;
    this.selectedId = 'auto';
    this.bound = new Set();
    this.deviceNames = [];
  }

  async connect() {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      throw new Error('unsupported');
    }
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => this.refresh();
    this.refresh();
    return this.deviceNames;
  }

  listInputs() {
    if (!this.access) return [];
    const out = [];
    this.access.inputs.forEach(i => out.push({ id: i.id, name: i.name, state: i.state, manufacturer: i.manufacturer || '' }));
    return out;
  }

  refresh() {
    const inputs = this.listInputs();
    const available = inputs.filter(i => i.state !== 'disconnected');
    this.deviceNames = available.map(i => i.name);
    for (const b of this.bound) {
      try { b.onmidimessage = null; } catch (e) { }
    }
    this.bound.clear();
    for (const i of this.access ? [...this.access.inputs.values()] : []) {
      const selected = this.selectedId === 'auto' ? true : i.id === this.selectedId;
      if (selected && i.state !== 'disconnected') {
        i.onmidimessage = e => this.handle(e);
        this.bound.add(i);
      }
    }
    const stillThere = available.some(i => i.id === this.selectedId);
    if (this.selectedId !== 'auto' && !stillThere) {
      if (this.handlers.onDisconnect) this.handlers.onDisconnect(this.deviceNames);
    }
    if (this.handlers.onDevices) this.handlers.onDevices(available, this.selectedId);
  }

  setDevice(id) {
    this.selectedId = id;
    this.refresh();
  }

  handle(event) {
    const msg = parseMessage(event.data);
    if (!this.handlers.onMessage) return;
    this.handlers.onMessage(msg);
  }

  statusText() {
    if (!this.access) return 'Not connected';
    if (this.deviceNames.length === 0) return 'No keyboard found. Plug it in, or turn on its Bluetooth MIDI.';
    return 'Connected: ' + this.deviceNames.join(', ');
  }
}
