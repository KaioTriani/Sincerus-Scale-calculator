import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useScroll, useSpring, useTransform, animate, useInView } from 'motion/react';
import { ArrowRight, Calculator, Target, LineChart, MessageCircle, Smartphone, Car, Store, Stethoscope, ShieldCheck, Menu, X, Sparkles, Zap } from 'lucide-react';
import Logo from '../components/Logo';
import Button from '../components/Button';
import Reveal from '../components/Reveal';
import Aurora from '../components/Aurora';
import { simulate, money, decimal } from '@/lib/simulation';
import { BRAND } from '@/lib/brand';

const WHATSAPP = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent('Olá, equipe Sincerus Scale! Quero falar sobre tráfego pago para a minha loja.')}`;
// Projeção real da calculadora (mesma fórmula da página /calculadora) para R$ 3.000/mês
const SIM = simulate({ investment: 3000 });

function Counter({ to, prefix = '', suffix = '', decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.8, ease: [0.16, 1, 0.3, 1], onUpdate: setVal });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{prefix}{val.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

function Tilt({ children, className = '' }) {
  const x = useMotionValue(0), y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 150, damping: 18 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-10, 10]), { stiffness: 150, damping: 18 });
  return (
    <motion.div
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left) / r.width - 0.5); y.set((e.clientY - r.top) / r.height - 0.5); }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const SERVICES = [
  { icon: Target, title: 'Campanhas que geram conversa', text: 'Meta Ads desenhado para levar o comprador de iPhone direto ao WhatsApp da loja — com público, oferta e criativo testados.' },
  { icon: MessageCircle, title: 'Do anúncio à venda', text: 'Acompanhamos o ritmo de conversas por dia e ajudamos a equipe a responder no tempo certo, porque sem atendimento a taxa de fechamento cai.' },
  { icon: LineChart, title: 'Relatórios sem ruído', text: 'Todo mês: gasto, conversas, custo por resultado e o que fazer a seguir — em um relatório claro, com os números do Gerenciador.' },
];

const STEPS = [
  { n: '01', title: 'Diagnóstico', text: 'Conta, histórico, ticket e margem por aparelho.' },
  { n: '02', title: 'Estrutura', text: 'Campanhas, públicos e criativos por modelo de iPhone.' },
  { n: '03', title: 'Escala', text: 'Verba onde o custo por conversa é saudável.' },
  { n: '04', title: 'Clareza', text: 'Painel e relatório mensal com o que importa.' },
];

const NICHES = [
  { icon: Smartphone, title: 'Lojas de iPhone e Apple', text: 'Nosso foco principal: seminovos, lacrados e acessórios.', main: true },
  { icon: Car, title: 'Automotivo', text: 'Concessionárias e lojas de veículos.' },
  { icon: Store, title: 'Varejo e eletrônicos', text: 'Lojas físicas que vendem pelo WhatsApp.' },
  { icon: Stethoscope, title: 'Serviços locais', text: 'Clínicas, imobiliárias e prestadores.' },
];

export default function Landing() {
  const [open, setOpen] = useState(false);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const heroFade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const maxSales = Math.max(...SIM.scenarios.map((s) => s.sales));
  const nav = [['#servicos', 'Serviços'], ['#metodo', 'Método'], ['#nichos', 'Nichos'], ['/calculadora/', 'Calculadora']];

  return (
    <div className="relative overflow-x-clip">
      {/* NAV */}
      <header className="fixed inset-x-0 top-0 z-40 px-3">
        <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full border border-white/[0.08] bg-carbon-950/50 px-4 py-2.5 backdrop-blur-2xl">
          <a href="/"><Logo size={28} /></a>
          <nav className="hidden items-center gap-7 text-sm text-white/65 md:flex">
            {nav.map(([href, l]) => <a key={href} href={href} className="transition hover:text-white">{l}</a>)}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Link to="/login" className="px-3 text-sm text-white/60 transition hover:text-white">Área do time</Link>
            <Button href={WHATSAPP} target="_blank" rel="noreferrer" iconRight={ArrowRight} className="py-2!">Falar com a Sincerus</Button>
          </div>
          <button className="rounded-full p-2 text-white/80 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="glass-strong mx-auto mt-2 flex max-w-6xl flex-col gap-1 p-3 md:hidden">
            {nav.map(([href, l]) => <a key={href} href={href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/5">{l}</a>)}
            <Link to="/login" className="rounded-xl px-3 py-2.5 text-sm text-white/60 hover:bg-white/5">Área do time</Link>
            <Button href={WHATSAPP} target="_blank" rel="noreferrer" iconRight={ArrowRight} className="w-full">Falar com a Sincerus</Button>
          </motion.div>
        )}
      </header>

      {/* HERO */}
      <section ref={heroRef} className="relative flex min-h-[100svh] items-center pb-20 pt-32">
        <Aurora />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[120vmin] w-[120vmin] -translate-x-1/2 -translate-y-1/2 animate-spinslow rounded-full border border-dashed border-white/[0.06]" />
        <motion.div style={{ y: heroY, opacity: heroFade }} className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="eyebrow">
              <Sparkles className="h-3.5 w-3.5" /> Tráfego pago para lojas de iPhone
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 text-[2.6rem] font-extrabold leading-[1.02] sm:text-6xl lg:text-7xl"
            >
              <span className="text-gradient">Mais iPhones vendidos.</span>
              <br />
              <span className="text-brand-gradient">Todo mês, em números.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.8 }} className="mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
              A Sincerus Scale é especialista em tráfego pago e performance para lojas de iPhone e Apple — e também atende outros nichos que vendem pelo WhatsApp. Anúncio certo, conversa certa, venda medida.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-9 flex flex-wrap items-center gap-3">
              <Button href="/calculadora/" icon={Calculator} iconRight={ArrowRight} className="px-7 py-3.5 text-[15px]">Simular meu investimento</Button>
              <Button href={WHATSAPP} target="_blank" rel="noreferrer" variant="ghost" icon={MessageCircle} className="px-6 py-3.5 text-[15px]">Falar no WhatsApp</Button>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-10 flex items-center gap-3 text-xs text-white/45">
              <ShieldCheck className="h-4 w-4 text-brand-300" /> Projeções com dados reais de 9 lojas de iPhone · base de setembro/2026
            </motion.div>
          </div>

          {/* Cartão com a projeção real da calculadora */}
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35, duration: 1.1, ease: [0.16, 1, 0.3, 1] }} className="relative mx-auto w-full max-w-md">
            <Tilt className="glass relative p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Simulação · {money(3000).replace(',00', '')}/mês</p>
                <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand-300">Calculadora</span>
              </div>
              <p className="mt-3 font-display text-4xl font-bold"><Counter to={SIM.scenarios[1].sales} decimals={1} /> <span className="text-base font-medium text-white/50">vendas estimadas</span></p>
              <p className="mt-1 text-xs text-white/45">Cenário base · {decimal(SIM.scenarios[1].conversations, 0)} conversas · {money(SIM.scenarios[1].cac)} por venda</p>
              <div className="mt-6 space-y-3">
                {SIM.scenarios.map((s, i) => (
                  <div key={s.name}>
                    <div className="flex justify-between text-xs text-white/60"><span>{s.name}</span><span className="font-semibold text-white">{decimal(s.sales)}</span></div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(s.sales / maxSales) * 100}%` }} transition={{ delay: 0.8 + i * 0.15, duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className={`h-full rounded-full ${i === 1 ? 'bg-linear-to-r from-brand-600 to-brand-300' : 'bg-white/25'}`} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-white/40">Estimativa, não garantia. Considera apenas vendas originadas em tráfego pago.</p>
            </Tilt>
            <div className="glass absolute -left-6 -top-8 hidden animate-floaty items-center gap-3 px-4 py-3 sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand/20"><MessageCircle className="h-4 w-4 text-brand-300" /></span>
              <div><p className="text-[11px] text-white/50">Base Sincerus</p><p className="text-sm font-semibold">6.408 conversas</p></div>
            </div>
            <div className="glass absolute -bottom-8 -right-4 hidden animate-floaty items-center gap-3 px-4 py-3 [animation-delay:-3s] sm:flex">
              <Zap className="h-4 w-4 text-brand-300" />
              <p className="text-sm font-medium">{decimal(SIM.scenarios[1].daily)} conversas/dia no cenário base</p>
            </div>
          </motion.div>
        </motion.div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-carbon-950 to-transparent" />
      </section>

      {/* NÚMEROS DA BASE (mesmos do rodapé da calculadora) */}
      <section className="relative mx-auto max-w-6xl px-5">
        <Reveal className="glass grid grid-cols-2 gap-6 p-6 sm:p-10 md:grid-cols-4">
          {[
            { v: 9, l: 'lojas de iPhone na base' },
            { v: 33836, p: 'R$ ', l: 'investidos em anúncios' },
            { v: 6408, l: 'conversas geradas' },
            { v: 96, l: 'vendas confirmadas na amostra' },
          ].map((s) => (
            <div key={s.l} className="text-center md:text-left">
              <p className="font-display text-3xl font-bold sm:text-4xl"><Counter to={s.v} prefix={s.p ?? ''} /></p>
              <p className="mt-1 text-sm text-white/50">{s.l}</p>
            </div>
          ))}
        </Reveal>
        <p className="mt-3 px-2 text-center text-[11px] text-white/35">Base atualizada em setembro/2026. Amostra de vendas: 3 lojas.</p>
      </section>

      {/* SERVIÇOS */}
      <section id="servicos" className="relative mx-auto max-w-6xl scroll-mt-28 px-5 py-28">
        <Reveal><span className="eyebrow">O que fazemos</span></Reveal>
        <Reveal delay={0.05}><h2 className="mt-5 max-w-2xl text-3xl font-bold sm:text-5xl">Performance feita para quem vende <span className="text-brand-gradient">iPhone.</span></h2></Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {SERVICES.map((s, i) => (
            <Reveal key={s.title} delay={0.1 * i}>
              <motion.div whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="glass group relative h-full overflow-hidden p-7">
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand/0 blur-3xl transition duration-700 group-hover:bg-brand/25" />
                <span className="relative grid h-12 w-12 place-items-center rounded-2xl border border-brand/30 bg-brand/10"><s.icon className="h-5 w-5 text-brand-300" /></span>
                <h3 className="relative mt-6 text-xl font-semibold">{s.title}</h3>
                <p className="relative mt-3 text-sm leading-relaxed text-white/55">{s.text}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* MÉTODO */}
      <section id="metodo" className="relative scroll-mt-28 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal><span className="eyebrow">Método Sincerus</span></Reveal>
          <Reveal delay={0.05}><h2 className="mt-5 text-3xl font-bold sm:text-5xl">Quatro atos. Um enredo: escalar.</h2></Reveal>
          <div className="relative mt-16 grid gap-6 md:grid-cols-4">
            <div aria-hidden className="absolute left-0 right-0 top-6 hidden h-px bg-linear-to-r from-transparent via-brand/50 to-transparent md:block" />
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={0.12 * i} className="relative">
                <span className="relative z-10 grid h-12 w-12 place-items-center rounded-full border border-brand/40 bg-carbon-900 font-display text-sm font-bold text-brand-300 shadow-glow">{s.n}</span>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-white/55">{s.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* NICHOS */}
      <section id="nichos" className="relative mx-auto max-w-6xl scroll-mt-28 px-5 py-24">
        <Reveal><span className="eyebrow">Para quem</span></Reveal>
        <Reveal delay={0.05}><h2 className="mt-5 max-w-2xl text-3xl font-bold sm:text-5xl">Especialistas em Apple. Prontos para outros nichos.</h2></Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NICHES.map((n, i) => (
            <Reveal key={n.title} delay={0.08 * i}>
              <div className={`glass h-full p-6 ${n.main ? 'border-brand/40! bg-brand/[0.07]!' : ''}`}>
                <n.icon className={`h-6 w-6 ${n.main ? 'text-brand-300' : 'text-white/60'}`} />
                <p className="mt-5 font-display text-lg font-semibold">{n.title}</p>
                <p className="mt-2 text-sm text-white/55">{n.text}</p>
                {n.main && <span className="mt-4 inline-block rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">Foco principal</span>}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CALCULADORA */}
      <section className="relative mx-auto max-w-6xl px-5 pb-24">
        <Reveal className="relative overflow-hidden rounded-[2.5rem] border border-brand/25 bg-linear-to-br from-brand/20 via-carbon-900 to-carbon-950 p-10 text-center sm:p-16">
          <Aurora grid={false} />
          <img src="/logo-mark.png" alt="" className="relative mx-auto h-14 w-auto drop-shadow-[0_0_30px_rgba(247,96,0,0.6)]" />
          <h2 className="relative mt-6 text-3xl font-bold sm:text-5xl">Quanto sua loja pode vender?</h2>
          <p className="relative mx-auto mt-4 max-w-lg text-white/60">Informe o investimento mensal e veja conversas, vendas estimadas e custo por venda em três cenários.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/calculadora/" icon={Calculator} iconRight={ArrowRight} className="px-8 py-3.5 text-[15px]">Abrir a calculadora</Button>
            <Button href={WHATSAPP} target="_blank" rel="noreferrer" variant="ghost" icon={MessageCircle} className="px-6 py-3.5 text-[15px]">Falar com a Sincerus</Button>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-white/[0.06] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-xs text-white/40 sm:flex-row">
          <Logo size={22} />
          <div className="flex items-center gap-5">
            <a href={BRAND.instagram} target="_blank" rel="noreferrer" className="hover:text-white">Instagram</a>
            <a href={WHATSAPP} target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp</a>
            <Link to="/login" className="hover:text-white">Área do time</Link>
          </div>
          <p>© 2026 Sincerus Scale · Tráfego pago e performance</p>
        </div>
      </footer>
    </div>
  );
}
