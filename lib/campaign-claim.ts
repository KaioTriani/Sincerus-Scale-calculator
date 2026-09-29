import { CAMPAIGN_KEY, CAMPAIGN_PRIZES, campaignDraw } from './campaign.ts';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export type CampaignClaim = { amount: number; index: number; createdAt: number };

// Browser persistence, not an authoritative anti-fraud or redemption database.
export function readCampaignClaim(storage: StorageLike): CampaignClaim | null {
  const raw = storage.getItem(CAMPAIGN_KEY);
  if (raw === null) return null;
  // Preserve prizes from the first campaign version; never grant an extra spin.
  if (raw === '200' || raw === '300') {
    const amount = Number(raw);
    return { amount, index: amount === 200 ? 0 : 1, createdAt: 0 };
  }
  const record = JSON.parse(raw);
  if (!record || !Number.isInteger(record.index) || record.index < 0 || record.index >= CAMPAIGN_PRIZES.length || CAMPAIGN_PRIZES[record.index] !== record.amount || !Number.isFinite(record.createdAt)) {
    throw new Error('Registro de participação inválido.');
  }
  return record;
}

export function claimCampaign(storage: StorageLike, random?: () => number) {
  const existing = readCampaignClaim(storage);
  if (existing) return { claim: existing, fresh: false };
  const draw = campaignDraw(random);
  const claim: CampaignClaim = { amount: draw.amount, index: draw.index, createdAt: Date.now() };
  // Write before animating. If persistence fails, do not enable a new draw.
  storage.setItem(CAMPAIGN_KEY, JSON.stringify(claim));
  const verified = readCampaignClaim(storage);
  if (!verified) throw new Error('Não foi possível registrar a participação.');
  return { claim: verified, fresh: verified.index === claim.index && verified.createdAt === claim.createdAt };
}

export function prizeRotation(index: number, turns = 7) {
  if (!Number.isInteger(index) || index < 0 || index >= CAMPAIGN_PRIZES.length) throw new Error('Setor inválido');
  return turns * 360 + 360 - (index + .5) * (360 / CAMPAIGN_PRIZES.length);
}
