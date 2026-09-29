import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Check, Gift, Sparkles } from 'lucide-react';
import { BRAND } from '../lib/brand';
import { CAMPAIGN_KEY, CAMPAIGN_PRIZES, campaignDraw, campaignWhatsApp } from '../lib/campaign';

function savedPrize(): number | null {
  try { const amount = Number(localStorage.getItem(CAMPAIGN_KEY)); return amount === 200 || amount === 300 ? amount : null; } catch { return null; }
}
function point(degrees: number, radius: number) {
  const angle = (degrees - 90) * Math.PI / 180;
  return [200 + radius * Math.cos(angle), 200 + radius * Math.sin(angle)];
}

export function CampaignWheel() {
  const [reward, setReward] = useState<number | null>(savedPrize);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(() => reward === null ? 0 : 360 - ((reward === 200 ? 0 : 1) * 45 + 22.5));
  const pending = useRef<number | null>(null);
  const locked = useRef(reward !== null);
  const reduced = useReducedMotion();
  const discAngle = useMotionValue(rotation);
  const pointerAngle = useMotionValue(0);
  const lastSector = useRef(0);
  const pointerAnimation = useRef<{ stop: () => void } | null>(null);
  useEffect(() => () => pointerAnimation.current?.stop(), []);
  useMotionValueEvent(discAngle, 'change', angle => {
    const sector = Math.floor(angle / 45);
    if (pending.current === null || reduced || sector === lastSector.current) return;
    lastSector.current = sector;
    pointerAnimation.current?.stop();
    pointerAngle.set(-18);
    pointerAnimation.current = animate(pointerAngle, 0, { type: 'spring', stiffness: 650, damping: 18 });
  });
  function spin() {
    if (locked.current) return;
    locked.current = true;
    const draw = campaignDraw();
    pending.current = draw.amount;
    // Save at draw time so reloading during the animation keeps the same result.
    try { localStorage.setItem(CAMPAIGN_KEY, String(draw.amount)); } catch { /* Works without storage too. */ }
    setSpinning(true);
    setRotation(draw.rotation);
  }
  function finish() {
    if (pending.current === null) return;
    setReward(pending.current); pending.current = null; setSpinning(false);
  }
  return <main className="campaign">
    <div className="campaign-grain" aria-hidden="true" />
    <section className="campaign-content" aria-label="Roleta exclusiva Sincerus">
      <div className="campaign-brand"><img src="/logo-mark.png" width="33" height="30" alt="" /><span>SINCERUS <small>SCALE</small></span></div>
      <div className="campaign-badge"><span /> EDIÇÃO EXCLUSIVA</div>
      <h1>{reward === null ? <>Um giro.<br /><em>Uma boa surpresa.</em></> : <>Esse giro<br /><em>foi seu.</em></>}</h1>
      <p className="campaign-intro">{reward === null ? 'Seu cashback está a um toque de distância.' : 'Seu benefício já está aqui. Agora é com você.'}</p>
      <div className={`campaign-stage ${spinning ? 'is-spinning' : ''}`}>
        <motion.div className="campaign-orbit" aria-hidden="true"
          animate={{scale:spinning && !reduced ? [1,1.045,1] : 1,opacity:spinning && !reduced ? [.45,1,.45] : 1}}
          transition={{duration:1.5,repeat:spinning && !reduced ? Infinity : 0}} />
        <motion.div className="campaign-pointer" style={{rotate:pointerAngle,transformOrigin:'50% 15%'}} aria-hidden="true"><span /></motion.div>
        <div className="campaign-rim">
          <div className="campaign-lights" aria-hidden="true">{Array.from({length:32},(_,i)=><i key={i} style={{transform:`rotate(${i*11.25}deg)`}}><b /></i>)}</div>
          <motion.div className="campaign-disc" style={{rotate:discAngle}}
            animate={{rotate:spinning && !reduced ? [0,-14,rotation*.72,rotation-45,rotation+3,rotation] : rotation}}
            transition={spinning && !reduced ? {duration:7,times:[0,.07,.49,.78,.95,1],ease:['easeInOut','easeInOut','easeOut','easeOut','easeInOut']} : {duration:0}}
            onAnimationComplete={finish} aria-hidden="true">
            <svg viewBox="0 0 400 400" role="presentation">
              {CAMPAIGN_PRIZES.map((amount,i)=>{
                const start=point(i*45,198),end=point((i+1)*45,198);
                const [x,y]=point(i*45+22.5,134);
                const pale=i===2||i===6;
                return <g key={i}>
                  <path d={`M200 200 L${start.join(' ')} A198 198 0 0 1 ${end.join(' ')} Z`} fill={pale?'#f8f8f8':i%2?'#f76001':'#181818'} stroke="#090909" strokeWidth="1.5" />
                  <g transform={`translate(${x} ${y}) rotate(${i*45+22.5})`} fill={pale||i%2?'#090909':'#f8f8f8'} textAnchor="middle">
                    <text y="-14" fontSize="12" fontWeight="600">R$</text><text y="15" fontSize="31" fontWeight="800" letterSpacing="-1">{amount}</text><text y="31" fontSize="8" fontWeight="700" letterSpacing="1">CASHBACK</text>
                  </g>
                </g>;
              })}
            </svg>
          </motion.div>
          <div className="campaign-hub" aria-hidden="true"><img src="/logo-mark.png" alt="" /><span>SEU GIRO</span></div>
        </div>
        {reward !== null && !reduced && <div className="campaign-confetti" aria-hidden="true">{Array.from({length:20},(_,i)=><i key={i} style={{left:`${5+i*4.7}%`,background:i%3===0?'#f8f8f8':'#f76001',animationDelay:`${i%5*.08}s`,transform:`rotate(${i*37}deg)`}} />)}</div>}
      </div>
      <div className="campaign-action" aria-live="polite" aria-atomic="true">
        {reward === null ? <>
          <p className="campaign-hint"><Sparkles size={14}/>{spinning ? 'Preparando sua surpresa…' : 'R$ 200 ou R$ 300. Qual vai ser o seu?'}</p>
          <button className="campaign-cta" onClick={spin} disabled={spinning}><Gift size={20}/>{spinning ? 'GIRANDO…' : 'QUERO GIRAR'}<ArrowUpRight size={21}/></button>
          <span className="campaign-micro">{spinning ? 'Aguarde o giro terminar.' : 'Toque, gire e descubra.'}</span>
        </> : <motion.div initial={{opacity:0,y:reduced?0:14}} animate={{opacity:1,y:0}} className="campaign-result">
          <span className="campaign-result-label"><Check size={15}/> SEU CASHBACK EXCLUSIVO</span>
          <strong><small>R$</small> {reward}<span>,00</span></strong>
          <a className="campaign-cta" href={campaignWhatsApp(BRAND.whatsapp,reward)} target="_blank" rel="noopener noreferrer">QUERO MEU CASHBACK<ArrowUpRight size={21}/></a>
          <span className="campaign-micro">Continue pelo WhatsApp para combinar o resgate.</span>
        </motion.div>}
      </div>
      <p className="campaign-terms">Prêmios desta roleta: R$ 200 ou R$ 300 de cashback, com chances iguais. Condições de utilização confirmadas com a Sincerus pelo WhatsApp.</p>
    </section>
  </main>;
}

