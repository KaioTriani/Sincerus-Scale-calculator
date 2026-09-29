import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_KEY, CAMPAIGN_PRIZES } from '../lib/campaign.ts';
import { claimCampaign, readCampaignClaim, prizeRotation } from '../lib/campaign-claim.ts';
const storage=(initial=null)=>{let value=initial;return {getItem:()=>value,setItem:(_key,v)=>{value=v;}};};
test('persiste antes da animação e reutiliza o prêmio sem novo sorteio',()=>{
 const s=storage(); const first=claimCampaign(s,()=>3);
 assert.equal(first.fresh,true); assert.equal(first.claim.amount,300);
 const second=claimCampaign(s,()=>{throw new Error('Não pode sortear novamente');});
 assert.equal(second.fresh,false); assert.deepEqual(second.claim,first.claim);
});
test('mantém os prêmios antigos e bloqueia registros inválidos',()=>{
 for(const amount of [200,300]) assert.equal(claimCampaign(storage(String(amount))).claim.amount,amount);
 for(const raw of ['invalid','null','{}','500',JSON.stringify({index:0,amount:300,createdAt:1})]) assert.throws(()=>claimCampaign(storage(raw)));
});
test('falha de armazenamento não concede giro sem registro',()=>{
 assert.throws(()=>claimCampaign({getItem:()=>null,setItem:()=>{throw new Error('blocked');}},()=>0));
});
test('rotação leva qualquer setor elegível ao centro do ponteiro',()=>{
 CAMPAIGN_PRIZES.forEach((amount,index)=>{
  const angle=prizeRotation(index);assert.equal(Math.floor(((360-angle%360)%360)/45),index);
 });
 assert.throws(()=>prizeRotation(8));
});
