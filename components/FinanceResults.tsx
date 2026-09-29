import { Info } from 'lucide-react';
import { decimal, money } from '@/lib/simulation';
import type { Scenario } from '@/lib/simulation';

const metrics = [
  { key: 'revenue', label: 'Lucro bruto¹' },
  { key: 'profit', label: 'Lucro líquido' },
  { key: 'roas', label: 'ROAS do modelo¹' },
] as const;

function value(scenario: Scenario, key: typeof metrics[number]['key']) {
  return key === 'roas' ? `${decimal(scenario.roas!, 2)}×` : money(scenario[key]!);
}

export function FinanceResults({ scenarios }: { scenarios: Scenario[] }) {
  return <section className="finance" aria-labelledby="finance-title">
    <h3 id="finance-title" className="finance-title">Retorno sobre a margem <Info size={15} /></h3>
    <div className="finance-table">
      <table><thead><tr><th scope="col">Métrica</th>{scenarios.map(s => <th scope="col" key={s.name}>{s.name}</th>)}</tr></thead>
        <tbody>{metrics.map(metric => <tr key={metric.key}><th scope="row">{metric.label}</th>{scenarios.map(s => <td key={s.name}>{value(s, metric.key)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <div className="finance-cards">
      {scenarios.map(s => <article className="finance-card" key={s.name}>
        <h4>{s.name}</h4>
        <dl>{metrics.map(metric => <div key={metric.key}><dt>{metric.label}</dt><dd>{value(s, metric.key)}</dd></div>)}</dl>
      </article>)}
    </div>
    <p className="small muted">¹ O PDF usa a margem por aparelho, não o preço de venda. Estes valores não representam faturamento nem ROAS sobre faturamento.</p>
  </section>;
}
