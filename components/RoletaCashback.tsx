'use client';
import { useRef, useState } from 'react';
import { Gift, ArrowRight, X, Check, MessageCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogClose, DialogTrigger } from './ui/dialog';
import { BRAND } from '@/lib/brand';
import { cashbackOptions, money, wheelIndex } from '@/lib/simulation';
import type { Simulation } from '@/lib/simulation';
import { WhatsAppButton } from './WhatsAppButton';

export function RoletaCashback({ simulation }: { simulation: Simulation }) {
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [reward, setReward] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  const locked = useRef(false);
  const reduced = useReducedMotion();
  const options = cashbackOptions(simulation.input.investment);

  function spin() {
    if (locked.current || reward !== null) return;
    locked.current = true;
    const index = wheelIndex();
    pending.current = options[index];
    setSpinning(true);
    setRotation(6 * 360 + 360 - (index * 60 + 30));
  }
  function finish() {
    if (pending.current === null) return;
    setReward(pending.current);
    pending.current = null;
    setSpinning(false);
  }

  return (
    <Dialog open={open} onOpenChange={value => { if (!spinning) setOpen(value); }}>
      <div className="cashback-banner next-step-banner">
        <span className="step next-step-number">03</span>
        <div>
          <strong>{reward === null ? 'Gostou da projeção?' : 'Tudo pronto para conversar.'}</strong>
          <p>Leve seu resumo para nossa equipe e veja como começar.</p>
        </div>
        {reward === null ? (
          <DialogTrigger asChild>
            <button className="primary"><MessageCircle size={17} />Avançar para o WhatsApp<ArrowRight size={17} /></button>
          </DialogTrigger>
        ) : <WhatsAppButton simulation={simulation} cashback={reward} />}
      </div>
      <p className="next-step-note">Você poderá revisar a mensagem antes de enviar. Sem compromisso.</p>
      <DialogContent className="wheel-modal" showCloseButton={false}
        onEscapeKeyDown={e => { if (spinning) e.preventDefault(); }}
        onPointerDownOutside={e => { if (spinning) e.preventDefault(); }}>
        <DialogClose asChild><button className="modal-close" disabled={spinning} aria-label="Fechar roleta"><X size={20} /></button></DialogClose>
        <div className="eyebrow">UMA SURPRESA PARA VOCÊ</div>
        <DialogTitle className="wheel-title">Antes de continuar,<br />um benefício exclusivo.</DialogTitle>
        <DialogDescription className="wheel-description">
          Gire e descubra seu cashback. Ele vai junto com seu resumo no WhatsApp.
          <span className="wheel-investment">Sua simulação: <strong>{money(simulation.input.investment)}/mês</strong></span>
        </DialogDescription>
        <div className="wheel-container">
          <div className="wheel-pointer" />
          <motion.div className="wheel" animate={{ rotate: rotation }}
            transition={{ duration: reduced ? 0.01 : 4.8, ease: [0.12, 0.8, 0.12, 1] }}
            onAnimationComplete={finish} aria-hidden="true">
            {options.map((amount, i) => (
              <div key={i} className={`wheel-value slice-${i}`}
                style={{ transform: `translate(-50%,-50%) rotate(${i * 60 + 30}deg) translateY(calc(-1 * var(--wheel-label-radius, 105px))) rotate(${-i * 60 - 30}deg)` }}>
                <small>R$</small>{amount}
              </div>
            ))}
          </motion.div>
          <div className="wheel-hub"><img src="/logo-mark.png" alt="Sincerus Scale" width="44" height="40" /></div>
        </div>
        <div className="wheel-live" role="status" aria-live="polite">
          {reward !== null ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <span className="reward-label"><Check size={17} />Seu cashback exclusivo</span>
              <strong className="reward-value">{money(reward)}</strong>
              <p className="reward-next">Agora é só levar sua simulação para a nossa equipe.</p>
            </motion.div>
          ) : <p>{spinning ? 'A roleta está girando…' : 'Toque no botão abaixo para descobrir seu benefício.'}</p>}
        </div>
        {reward === null ? (
          <button className="primary spin-button" disabled={spinning} onClick={spin}>
            <Gift size={18} />{spinning ? 'Girando…' : 'Girar e descobrir meu benefício'}
          </button>
        ) : <WhatsAppButton simulation={simulation} cashback={reward} />}
        <p className="wheel-terms">{BRAND.cashback.terms}</p>
        <span className="sr-only">Valores elegíveis, com chances iguais por setor: {options.map(money).join('; ')}.</span>
      </DialogContent>
    </Dialog>
  );
}
