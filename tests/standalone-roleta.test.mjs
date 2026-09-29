import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../roleta/index.html', import.meta.url), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('entrada independente da roleta tem JavaScript válido e aviso de setores ilustrativos', () => {
  assert.ok(code);
  assert.doesNotThrow(() => new vm.Script(code));
  assert.match(html, /elementos visuais ilustrativos/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.ok(!html.includes('/roleta/main.tsx'));
});

test('perfil de animação mantém velocidade contínua e termina na posição exata', () => {
  const start = code.indexOf('function spinProgress(');
  const end = code.indexOf('function trackPointer(', start);
  const context = vm.createContext({});
  vm.runInContext(code.slice(start, end), context);
  assert.equal(context.spinProgress(0), 0);
  assert.equal(context.spinProgress(1), 1);
  let previous = 0;
  for (let i = 1; i <= 10000; i++) {
    const value = context.spinProgress(i / 10000);
    assert.ok(value >= previous - 1e-12 && value <= 1);
    previous = value;
  }
  for (const index of [2, 5]) {
    const target = 7 * 360 + 360 - (index + .5) * 45;
    const frames = context.spinKeyframes(target);
    assert.equal(frames.at(-1).transform, `rotate(${target}deg)`);
    assert.equal(Math.floor(((360 - target % 360) % 360) / 45), index);
  }
});
