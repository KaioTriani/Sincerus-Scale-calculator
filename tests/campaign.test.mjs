import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_PRIZES, campaignDraw, campaignWhatsApp } from '../lib/campaign.ts';
test('todos os setores são elegíveis e o ponteiro para no prêmio escolhido',()=>{
  for(let n=0;n<256;n++){
    const result=campaignDraw(()=>n);
    assert.ok([200,300].includes(result.amount));
    const underPointer=((360-result.rotation%360)%360);
    assert.equal(Math.floor(underPointer/45),result.index);
    assert.equal(CAMPAIGN_PRIZES[result.index],result.amount);
  }
  assert.equal(CAMPAIGN_PRIZES.filter(n=>n===200).length,4);
  assert.equal(CAMPAIGN_PRIZES.filter(n=>n===300).length,4);
});
test('WhatsApp contém o valor exato e a campanha, com codificação válida',()=>{
  for(const amount of [200,300]){
    const url=new URL(campaignWhatsApp('5583999054165',amount));
    assert.equal(url.hostname,'wa.me');
    assert.ok(url.searchParams.get('text').includes(`R$ ${amount},00`));
    assert.ok(url.searchParams.get('text').includes('TikTok'));
  }
  assert.throws(()=>campaignWhatsApp('5583999054165',500));
});
