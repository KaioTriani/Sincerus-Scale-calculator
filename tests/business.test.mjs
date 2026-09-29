import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, cashbackOptions, wheelIndex } from '../lib/simulation.ts';
import { whatsappMessage, whatsappURL } from '../lib/whatsapp.ts';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('cenário base reproduz a fórmula sem arredondamento intermediário', () => {
  const result = simulate({investment:3000});
  assert.equal(result.scenarios.length,3);
  near(result.factor,1);
  near(result.scenarios[1].conversations,568.1818181818181);
  near(result.scenarios[1].sales,28.636363636363633);
  near(result.scenarios[1].cac,104.76190476190477);
  assert.equal(result.scenarios[1].profit,undefined);
  assert.equal(result.scenarios[1].roas,undefined);
});
test('degradação contínua e alertas respeitam os limites estritos',()=>{
  for(const [investment,factor] of [[3000,1],[3001,1.00004],[5000,1.08],[8000,1.2],[10000,1.28]]) near(simulate({investment}).factor,factor);
  assert.ok(!simulate({investment:5000}).alerts.some(a=>a.startsWith('Acima de R$ 5.000')));
  assert.ok(simulate({investment:5001}).alerts.some(a=>a.startsWith('Acima de R$ 5.000')));
  assert.ok(!simulate({investment:8000}).alerts.some(a=>a.includes('única conta')));
  assert.ok(simulate({investment:8001}).alerts.some(a=>a.includes('única conta')));
  assert.ok(!simulate({investment:10000}).alerts.some(a=>a.startsWith('Acima de R$ 10.000')));
  assert.ok(simulate({investment:10001}).alerts.some(a=>a.startsWith('Acima de R$ 10.000')));
});
test('zero é margem válida; histórico substitui os padrões; capacidade alerta',()=>{
  const result=simulate({investment:1500,margin:0,cost:6,closing:10,capacity:0});
  assert.equal(result.scenarios[1].sales,25);
  assert.equal(result.scenarios[1].cac,60);
  assert.equal(result.scenarios[1].profit,-1500);
  assert.equal(result.scenarios[1].roas,0);
  assert.equal(result.scenarios[0].cost,9.91);
  assert.ok(result.alerts.some(a=>a.startsWith('Capacidade de')));
  const withMargin=simulate({investment:1500,margin:500,cost:6,closing:10});
  assert.equal(withMargin.scenarios[1].revenue,12500);
  assert.equal(withMargin.scenarios[1].profit,11000);
});
test('entradas vazias, não finitas e fora dos limites não projetam',()=>{
  for(const investment of [0,-1,1499,NaN,Infinity,1e10]) assert.throws(()=>simulate({investment}));
  for(const extra of [{cost:0},{closing:0},{closing:101},{margin:-1},{capacity:-1}]) assert.throws(()=>simulate({investment:1500,...extra}));
  assert.doesNotThrow(()=>simulate({investment:1500}));
});
test('cashback proporcional é limitado a R$ 400–500 em todos os setores',()=>{
  assert.deepEqual(cashbackOptions(1500),[400,420,440,460,480,500]);
  assert.deepEqual(cashbackOptions(1650),[401,421,441,461,481,500]);
  assert.deepEqual(cashbackOptions(1875),[403,423,443,463,483,500]);
  assert.deepEqual(cashbackOptions(3000),[415,435,455,475,495,500]);
  for (const investment of [1500,1875,3000,5000,15000,1e9]) {
    assert.equal(new Set(cashbackOptions(investment)).size,6,'Seis valores distintos em qualquer verba');
  }
  for(const investment of [1500,1501,1600,1800,3000,1000000]) assert.ok(cashbackOptions(investment).every(v=>v>=400&&v<=500));
  assert.throws(()=>cashbackOptions(1499));
  for(let i=0;i<6;i++) assert.equal(wheelIndex(()=>i),i);
  const values=[2**32-1,3]; assert.equal(wheelIndex(()=>values.shift()),3);
});
test('WhatsApp preserva caracteres, três cenários, dados e cashback exato',()=>{
  const sim=simulate({investment:1650,margin:500,capacity:25});
  const message=whatsappMessage(sim,462);
  for(const text of ['Conservador','Base','Otimista','Lucro bruto','Lucro líquido','Cashback','462,00','96 vendas','Não é garantia']) assert.ok(message.includes(text),text);
  const url=new URL(whatsappURL('5583999054165',sim,462));
  assert.equal(url.hostname,'wa.me');
  assert.equal(url.pathname,'/5583999054165');
  assert.equal(url.searchParams.get('text'),message);
  const noMargin=whatsappMessage(simulate({investment:1500}),400);
  assert.ok(!noMargin.includes('Lucro bruto:'));
});
