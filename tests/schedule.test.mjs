// Agenda das rotinas automáticas (server/jobs.mjs → dueJobs): o que roda em cada dia/horário e o que não repete.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sincerus-test-'));
const { dueJobs } = await import('../server/jobs.mjs');
const names = (d) => d.map(([n]) => n).sort().join(',');
const T0 = Date.UTC(2026, 10, 23, 12);

const cases = [
  ['segunda 7h: só alertas', { date: '2026-11-23', hour: 7, weekday: 'Mon' }, {}, 'alerts'],
  ['segunda 8h: resumo + semanal, sem alerta junto', { date: '2026-11-23', hour: 8, weekday: 'Mon' }, {}, 'daily,weekly'],
  ['segunda 9h, resumo e semanal feitos: anúncios ativos + alertas', { date: '2026-11-23', hour: 9, weekday: 'Mon' }, { lastDaily: '2026-11-23', lastWeekly: '2026-W48', lastAlertsAt: T0 - 3600000 }, 'activeAds,alerts'],
  ['tudo feito e alerta há 10 min: nada', { date: '2026-11-23', hour: 10, weekday: 'Mon' }, { lastDaily: '2026-11-23', lastWeekly: '2026-W48', lastActiveAds: '2026-11-23', lastAlertsAt: T0 - 600000 }, ''],
  ['terça: sem anúncios ativos nem semanal', { date: '2026-11-24', hour: 9, weekday: 'Tue' }, { lastDaily: '2026-11-24', lastAlertsAt: T0 - 3600000 }, 'alerts'],
  ['quinta 9h: anúncios ativos', { date: '2026-11-26', hour: 9, weekday: 'Thu' }, { lastDaily: '2026-11-26', lastAlertsAt: T0 }, 'activeAds'],
  ['quinta 8h: anúncios ativos ainda não', { date: '2026-11-26', hour: 8, weekday: 'Thu' }, { lastDaily: '2026-11-26', lastAlertsAt: T0 }, ''],
  ['dia 1º 8h: resumo + mensal', { date: '2026-12-01', hour: 8, weekday: 'Tue' }, {}, 'daily,monthly'],
  ['dia 1º com mensal feito: não repete', { date: '2026-12-01', hour: 14, weekday: 'Tue' }, { lastDaily: '2026-12-01', lastMonthly: '2026-12', lastAlertsAt: T0 }, ''],
  ['segunda que é dia 1º, 9h: tudo', { date: '2027-03-01', hour: 9, weekday: 'Mon' }, {}, 'activeAds,daily,monthly,weekly'],
  ['madrugada: nada', { date: '2026-11-24', hour: 3, weekday: 'Tue' }, { lastDaily: '2026-11-23', lastAlertsAt: 0 }, ''],
];
for (const [label, now, st, want] of cases) {
  test(label, () => assert.equal(names(dueJobs(now, st, T0)), want));
}
