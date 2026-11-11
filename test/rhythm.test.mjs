import { TempoTracker } from '../js/rhythm.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) { passed++; console.log('  ok - ' + name); }
  else { failed++; failures.push(name); console.log('  FAIL - ' + name + (detail ? ' [' + detail + ']' : '')); }
}

console.log('rhythm: steady quarter notes at 100 BPM');
{
  const t = new TempoTracker();
  let now = 0;
  for (let i = 0; i < 32; i++) {
    now += 600 + (Math.sin(i * 2.7) * 4);
    t.feed(now, 1);
  }
  const a = t.anchor();
  check('bpm near 100', Math.abs(a.bpm - 100) <= 3, a.bpm.toFixed(2));
  check('confidence decent', a.confidence > 0.5, a.confidence.toFixed(2));
  check('phase within a beat', a.phaseMs >= 0 && a.phaseMs < a.periodMs, a.phaseMs.toFixed(1));
}

console.log('rhythm: sixteenth arpeggio folds to quarter tempo');
{
  const t = new TempoTracker();
  let now = 0;
  for (let i = 0; i < 80; i++) {
    now += 150;
    t.feed(now, 1);
  }
  const a = t.anchor();
  check('arpeggio bpm folds near 100', Math.abs(a.bpm - 100) <= 6, a.bpm.toFixed(2));
}

console.log('rhythm: sparse chord changes give low confidence');
{
  const t = new TempoTracker();
  let now = 0;
  for (let i = 0; i < 8; i++) {
    now += 2000;
    t.feed(now, 1);
  }
  check('low confidence on sparse input', t.anchor().confidence < 0.35, t.anchor().confidence.toFixed(2));
}

console.log('rhythm: tempo change adaptation 100 -> 130');
{
  const t = new TempoTracker();
  let now = 0;
  for (let i = 0; i < 24; i++) { now += 600; t.feed(now, 1); }
  for (let i = 0; i < 30; i++) { now += 60000 / 130; t.feed(now, 1); }
  const a = t.anchor();
  check('adapts to 130', Math.abs(a.bpm - 130) <= 4, a.bpm.toFixed(2));
}

console.log('rhythm: gradual ritardando tracked');
{
  const t = new TempoTracker();
  let now = 0;
  let period = 600;
  for (let i = 0; i < 60; i++) {
    now += period;
    period *= 1.006;
    t.feed(now, 1);
  }
  const expected = 60000 / period;
  check('follows ritardando within 6 bpm', Math.abs(t.bpm - expected) <= 6, t.bpm.toFixed(2) + ' vs ' + expected.toFixed(2));
}

console.log('rhythm: manual override');
{
  const t = new TempoTracker();
  let now = 0;
  for (let i = 0; i < 16; i++) { now += 600; t.feed(now, 1); }
  t.setManualBpm(120);
  now += 600; t.feed(now, 1);
  check('manual bpm respected', t.anchor().bpm === 120, t.anchor().bpm);
  check('auto disabled by manual', t.anchor().auto === false);
  t.setAuto(true);
  now += 600; t.feed(now, 1);
  check('auto re-enabled', t.anchor().auto === true);
}

console.log('rhythm: onset bursts (ornaments) do not halve tempo');
{
  const t = new TempoTracker();
  for (let i = 1; i <= 16; i++) {
    const beat = 600 * i;
    t.feed(beat, 1);
    t.feed(beat + 60, 0.6);
    t.feed(beat + 120, 0.6);
  }
  check('grace notes do not derail bpm', Math.abs(t.bpm - 100) <= 5, t.bpm.toFixed(2));
}

export function report() {
  return { passed, failed, failures };
}
