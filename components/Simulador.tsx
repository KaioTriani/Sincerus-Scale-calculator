'use client';
import { useMemo, useState } from 'react';
import { ArrowUpRight, SlidersHorizontal, ShieldCheck, Info, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { Header } from './Header';
import { SplashScreen } from './SplashScreen';
import { Slider } from './ui/slider';
import { RoletaCashback } from './RoletaCashback';
import { FinanceResults } from './FinanceResults';
import { useSimulationTool } from './useSimulationTool';
import { simulate, money, decimal } from '@/lib/simulation';

export function Simulador() {
  const [investment, setInvestment] = useState('1500');
  const [margin, setMargin] = useState('');
  const result = useMemo(() => {
    try {
      return { data: simulate({ investment: Number(investment), margin: margin === '' ? undefined : Number(margin) }), error: '' };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }, [investment, margin]);
  const sim = result.data;
  useSimulationTool(sim, result.error);

  return <>
    <SplashScreen />
    <Header />
    <main id="main" className="main">
      <div className="intro">
        <div>
          <div className="eyebrow"><span />SIMULADOR DE TRÁFEGO PAGO</div>
          <h1>Seu próximo nível.<br /><span>Em números.</span></h1>
          <p>Descubra o potencial do seu investimento para sua loja de iPhone.</p>
        </div>
        <div className="data-stamp"><ShieldCheck size={23} /><div>Projeção com dados reais<small>9 lojas de iPhone · Setembro de 2026</small></div></div>
      </div>

      <div className="workspace">
        <section className="input-panel" aria-labelledby="input-title">
          <div className="section-title"><span className="step">01</span><h2 id="input-title">Monte sua projeção</h2><SlidersHorizontal size={18} /></div>
          <label className="field-label" htmlFor="investment">Investimento mensal em anúncios</label>
          <div className="investment-field"><span>R$</span><input id="investment" type="number" inputMode="decimal" min="1500" step="0.01" value={investment} onChange={e => setInvestment(e.target.value)} aria-describedby="investment-hint" /><span>/mês</span></div>
          <p id="investment-hint" className="small muted">Digite um valor ou arraste a barra. Mínimo de R$ 1.500 em anúncios, sem taxa de gestão.</p>
          <Slider aria-label="Ajustar investimento mensal" min={1500} max={15000} step={100} value={[Math.max(1500, Math.min(15000, Number(investment) || 1500))]} onValueChange={v => setInvestment(String(v[0]))} />
          <div className="range-labels"><span>R$ 1.500</span><span>R$ 15.000</span></div>
          <div className="presets">{[1500, 3000, 5000].map(value => <button key={value} className={Number(investment) === value ? 'selected' : ''} onClick={() => setInvestment(String(value))}>{money(value).replace(',00', '')}</button>)}</div>
          <div className="divider" />
          <label className="field-label" htmlFor="margin">Margem por aparelho <span>Opcional</span></label>
          <div className="text-field"><span>R$</span><input id="margin" type="number" inputMode="decimal" min="0" step="0.01" placeholder="Ex.: 500" value={margin} onChange={e => setMargin(e.target.value)} /></div>
          <p className="small muted">Quanto sobra por iPhone vendido, antes de descontar os anúncios. Não sabe? Pode deixar em branco.</p>
          <div className="live-note"><span />Atualização em tempo real</div>
        </section>

        <section className="results-panel" aria-labelledby="results-title">
          <div className="result-top"><div className="section-title"><span className="step">02</span><h2 id="results-title">Um investimento. Três possibilidades.</h2></div><span className="period">POR MÊS</span></div>
          {sim ? <>
            <p className="results-hint">Compare as estimativas abaixo. O cenário base é sua referência; os resultados mudam ao ajustar os valores.</p>
            <div className="scenario-grid">
              {sim.scenarios.map((scenario, index) => <motion.article key={scenario.name} className={`scenario ${index === 1 ? 'base' : ''}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
                <div className="scenario-label">{scenario.name}{index === 1 ? <span>REFERÊNCIA</span> : <ArrowUpRight size={16} />}</div>
                <div className="sales-number">{decimal(scenario.sales)}<span>vendas estimadas</span></div>
                <div className="volume-bar"><span style={{ width: `${Math.min(100, scenario.sales / Math.max(...sim.scenarios.map(s => s.sales)) * 100)}%` }} /></div>
                <dl>
                  <div><dt>Conversas</dt><dd>{decimal(scenario.conversations, 0)}</dd></div>
                  <div><dt title="Quanto você investe em anúncios para cada venda estimada">Custo por venda</dt><dd>{money(scenario.cac)}</dd></div>
                  <div><dt>Conversas / dia</dt><dd>{decimal(scenario.daily)}</dd></div>
                </dl>
                <div className="scenario-premise"><span>{money(scenario.cost)} / conversa</span><span>{decimal(scenario.closing, 2)}% de fechamento</span></div>
              </motion.article>)}
            </div>
            <div className="rhythm"><TrendingUp size={20} /><p>No cenário base, prepare sua equipe para <strong>{decimal(sim.scenarios[1].daily)} conversas por dia.</strong></p><span>30 dias / mês</span></div>
            {margin !== '' && <FinanceResults scenarios={sim.scenarios} />}
            <div className="alerts">{sim.alerts.map(alert => <p key={alert}><Info size={16} /><span>{alert}</span></p>)}</div>
            <RoletaCashback key={`${investment}|${margin}`} simulation={sim} />
          </> : <div className="error" role="alert">{result.error}</div>}
          <p className="disclaimer">Estimativa baseada em histórico real de 9 lojas. Não é garantia de resultado. A projeção considera apenas vendas originadas em tráfego pago.</p>
        </section>
      </div>
      <footer className="footer"><span>SINCERUS <b>SCALE</b></span><p>9 lojas · R$ 33.836 investidos · 6.408 conversas<br /><strong>Amostra de vendas: 3 lojas · 96 vendas confirmadas</strong></p><span>BASE ATUALIZADA<br /><b>SETEMBRO / 2026</b></span></footer>
    </main>
  </>;
}
