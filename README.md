# Sincerus Scale — site, calculadora, roleta e plataforma interna

Projeto preparado para importação do GitHub pela Hostinger.

## Endereços

| Caminho | O que é | Acesso |
|---|---|---|
| `/` | Landing page oficial (tráfego pago para lojas de iPhone/Apple e outros nichos) | Público |
| `/calculadora/` | Calculadora de escala (simulador original, lógica e relatório/WhatsApp preservados) | Público |
| `/roleta/` | Roleta independente (inalterada) | Público, `noindex` |
| `/login` | Login da equipe | Público |
| `/dashboard`, `/clientes`, `/relatorios` | Área restrita: métricas, carteira e relatórios Meta Ads | Somente logado |

Todos são caminhos do mesmo domínio; não precisa de DNS extra.

## Estrutura

```
index.html            → app da plataforma (src/main.jsx): landing + login + área restrita
calculadora/index.html → calculadora (client-entry.tsx + components/ + lib/ + app/globals.css)
roleta/index.html      → roleta independente
src/                   → plataforma (React Router, Recharts, motion, Tailwind 4)
  pages/               → Landing, Auth, Dashboard(+Live), Clients(+Live), Reports
  lib/report/          → relatório Meta Ads: leitura CSV/XLSX, cálculos, PDF (HTML A4) e XLSX
  lib/api.js           → chamadas ao servidor (/api)
server.js              → arquivo de entrada da aplicação Node (carrega .env local e sobe server/index.mjs)
server/                → servidor Node sem dependências: entrega o dist/ e a API
  auth.mjs             → login (scrypt) e sessão em cookie httpOnly assinado
  meta.mjs             → Meta Marketing API (somente leitura), com cache de 10 min
scripts/hash-password.mjs → gera o hash de senha para AUTH_USERS
```

A calculadora continua com seus próprios arquivos (`components/`, `lib/simulation.ts`, `app/globals.css`) e testes; só mudou de endereço.

## Publicar na Hostinger

A área restrita e a API da Meta precisam do **servidor Node** (`server.js` → `server/index.mjs`). Publicar como site estático não basta: o site abre, mas o login e os dados da Meta não funcionam.

No hPanel: **Sites → Adicionar site → Aplicativo web Node.js → Importar repositório do GitHub** (ou, se o domínio já estiver como aplicação Node, **Implantações → Configurações**):

| Configuração | Valor |
|---|---|
| Repositório / branch | `KaioTriani/Sincerus-Scale-calculator` / `main` |
| Framework | Outro / Express (aplicação Node, não "Vite" nem "React") |
| Node.js | 22.x (22.12 ou superior) |
| Diretório raiz | `./` |
| Comando de instalação | `npm install` |
| Comando de build | `npm run build` (na predefinição Express o campo some; o build roda sozinho no `postinstall`) |
| Arquivo de entrada | `server.js` |
| Comando de início (se o painel pedir) | `npm start` |
| Pasta de saída (se o painel pedir) | `dist` |

O servidor usa a porta que a Hostinger informa em `PORT`. As ferramentas de build (Vite, Tailwind) estão em `dependencies`, então o build funciona mesmo se a instalação rodar em modo produção.

Se o domínio hoje está como site estático (arquivos em `public_html`), crie a aplicação Node.js e aponte o domínio para ela; a página antiga em `public_html` deixa de ser usada.

### Variáveis de ambiente (painel da Hostinger)

| Variável | Obrigatória | Conteúdo |
|---|---|---|
| `SESSION_SECRET` | Sim | Texto aleatório com 32+ caracteres (assina o cookie de sessão) |
| `AUTH_USERS` | Sim | JSON com os usuários: `[{"username":"kaio.triani","name":"Kaio Triani","hash":"scrypt$…"}]`. Também aceita o mesmo JSON em base64, caso o painel altere aspas ou `$` |
| `META_ACCESS_TOKEN` | Para dados reais | Token do usuário do sistema do Business Manager, permissão `ads_read` |
| `META_API_VERSION` | Não | Versão da Graph API (padrão `v23.0`) |
| `NODE_ENV` | Recomendado | `production` (cookie só em HTTPS) |

Gere o hash de cada senha com `npm run hash-password -- "nome.sobrenome" "Nome Completo" "SENHA"`. Senhas e tokens **nunca** vão para o Git (`.env*` e `*.local.md` estão no `.gitignore`).

Depois de salvar as variáveis, reinicie/reimplante a aplicação. No log de execução aparece `Sincerus Scale na porta … · Meta API configurada`; avisos como `AUTH_USERS vazio` ou `SESSION_SECRET ausente` indicam variável faltando.

### Conferir depois de publicar

1. `https://sincerusscale.com.br/` abre a landing; `/calculadora/` e `/roleta/` abrem normalmente.
2. `/login` entra com um dos usuários; a barra lateral mostra **API conectada**.
3. **Clientes** lista as contas de anúncio; **Relatórios** carrega as campanhas de um cliente.

Sem `META_ACCESS_TOKEN`, a plataforma funciona em modo demonstração (dashboard e clientes) e os relatórios usam importação CSV/XLSX.

Se a Hostinger estiver publicando só arquivos estáticos (sem `npm start`), o site, a calculadora e a roleta funcionam, mas o login não: não há servidor para validar a senha.

### Ligar a API da Meta

1. Em [developers.facebook.com](https://developers.facebook.com), crie um app do tipo **Empresa** e adicione o caso de uso **Marketing API**; vincule ao Business Manager da Sincerus.
2. No Business Manager: **Configurações → Usuários do sistema → Adicionar** (função Funcionário). Em **Atribuir ativos**, dê acesso de **leitura** às contas de anúncio dos clientes.
3. Ainda no usuário do sistema: **Gerar token** para o app, com a permissão `ads_read` (sem expiração).
4. Cole o token em `META_ACCESS_TOKEN` no painel da Hostinger e reinicie a aplicação.
5. Na primeira vez, gere um relatório e compare a coluna **Resultados** com o Gerenciador. O mapeamento entre meta de otimização e evento de resultado fica em `server/meta.mjs` (`RESULT`).

## Desenvolvimento

```sh
npm install
npm run build && npm start   # servidor (server.js) + build em http://localhost:3000 (lê .env se existir)
npm run dev                  # Vite em http://localhost:5173 (encaminha /api para a porta 3000)
npm test
```

Crie um `.env` local com `SESSION_SECRET` e `AUTH_USERS` (e, se quiser, `META_ACCESS_TOKEN`).

## Código da roleta

**O arquivo ativo é `roleta/index.html`**, uma cópia completa de `roleta_sincerus_animacao_melhorada.html`, com CSS e JavaScript embutidos. Ele usa Web Animations API, tem aceleração contínua, desaceleração progressiva, ponteiro sincronizado e destaque do setor ao terminar.

O HTML informa que somente R$ 200 e R$ 300 são resultados disponíveis; os demais setores permanecem identificados como ilustrativos. O resultado e a participação são registrados no navegador. Esse controle e o fingerprint básico não são validação antifraude no servidor e não garantem unicidade por aparelho.

O arquivo mantém o comportamento original de abrir o WhatsApp após o resultado: `AUTO_REDIRECT = true`, com atraso de 2500 ms. O botão também permite continuar manualmente. Para usar somente o botão, altere essa constante para `false`.

Os antigos `components/CampaignWheel.tsx`, `lib/campaign*.ts` e `roleta/main.tsx` foram preservados como código anterior, mas não são carregados por esta página.

## Calculadora (simulador)

Mantém a calculadora, modal próprio de cashback e WhatsApp. Os nomes financeiros são **Lucro bruto** e **Lucro líquido**, com as fórmulas originais preservadas: bruto = vendas estimadas × margem por aparelho; líquido = bruto − investimento em anúncios; ROAS do modelo = bruto ÷ investimento. Outras despesas não são descontadas automaticamente.

WhatsApp comercial: +55 (83) 99905-4165.

## Envios automáticos pelo WhatsApp (ViaZapi / Chatwoot)

| Rotina | Quando (Brasília) | O que envia |
|---|---|---|
| `daily` | Todo dia, 8h | Resumo de todos os alertas abertos (saldo/pagamento, anúncios com erro/reprovados/duplicados, entrega, frequência) |
| `alerts` | A cada 30 min, 7h–23h | Só alertas novos (não roda logo depois do resumo do dia) |
| `activeAds` | Segunda e quinta, 9h (`ACTIVE_ADS_DAYS`, `ACTIVE_ADS_HOUR`) | **Mensagem** (sem PDF) com os anúncios ativos por cliente: campanhas e nº de anúncios; partes de até 10 clientes |
| `weekly` | Segunda, 8h | **Um PDF por cliente** ("Relatório para cliente", últimos 7 dias × 7 anteriores), cada um numa mensagem |
| `monthly` | Dia 1º, 8h | PDF interno do mês anterior: consolidado da operação (investimento, resultados, conversas, leads, custo médio, receita/ROAS quando houver, desempenho por cliente com variação × mês anterior, campanhas de maior investimento) + seção detalhada de cada cliente |

### Relatórios por e-mail

| E-mail | Quando | Conteúdo |
|---|---|---|
| Resumo do dia | Todo dia, 8h | PDF "Resumo do dia" no padrão Sincerus: avisos das contas, situação do sistema e anúncios ativos por cliente |
| Relatórios semanais | Segunda, 8h | Todos os PDFs da semana (um por cliente) num e-mail |
| Relatório interno | Dia 1º, 8h | PDF do mês anterior (consolidado + detalhe por cliente) |

Variáveis: `SMTP_USER` (ex.: relatorios@sincerusscale.com.br), `SMTP_PASS`, `REPORT_EMAILS` (destinatários separados por vírgula); opcionais `SMTP_HOST` (padrão smtp.hostinger.com), `SMTP_PORT` (465), `EMAIL_FROM`. Sem elas o e-mail fica desligado. Cada e-mail sai uma vez por período e não depende do WhatsApp.

### Verificação diária e defesas de envio

- **health** (todo dia 7h e `job=health`): testa pasta de dados, Cron, geração de PDF, link público dos PDFs, token da Meta (e quando expira), contas de anúncio, API do Chatwoot, modelos sincronizados (sincroniza sozinho se faltar), número do WhatsApp (status, qualidade), webhook do número, categoria dos modelos, mensagens recebidas e entregas das últimas 24h. O resultado aparece no fim do resumo das 8h e em `job=status`.
- **Envio conferido**: cada mensagem é acompanhada até ser entregue ou falhar.
- **Limite da Meta (131049)**: ao detectar, o número fica em pausa por 24h e o conteúdo vai para uma fila, reenviada automaticamente depois (avisos juntos numa mensagem, PDFs um a um). Nada de mensagens "Falha ao enviar" em sequência.
- **Preferência por Utilidade**: os avisos são divididos nos modelos aprovados como Utilidade (hoje `diario_sincerus_1`, `_2` e `_4`), que não têm limite por pessoa. PDFs usam `documento_sincerus` quando aprovado como Utilidade.
- **Menos mensagens**: alertas fora do resumo só saem na hora se forem urgentes (🔴); o resto entra no resumo das 8h.

O PDF de anúncios ativos continua disponível na plataforma e sob demanda (`job=activeAdsPdf&dry=1`), mas não é enviado automaticamente.

Registro: cada execução fica em `DATA_DIR/jobs-log.jsonl` (ok, falha parcial ou erro, com o resumo). Situação e últimas execuções: `/api/jobs/run?job=status&key=...`. Envios nunca se repetem: cada rotina marca a data antes de rodar, e a pasta de dados fica fora da pasta do app (não se perde ao reimplantar).

Os PDFs são gerados no servidor com Chrome sem tela (`puppeteer-core` + `@sparticuz/chromium` na Hostinger). Os geradores de relatório são empacotados em `dist-server/reports.mjs` pelo `npm run build`.

### Variáveis de ambiente

| Variável | Exemplo | Para quê |
|---|---|---|
| `JOBS_ENABLED` | `1` | Liga as rotinas |
| `REPORT_PHONES` | `+5583900000000,+5583911111111` | Quem recebe |
| `VIAZAPI_BASE_URL` | `https://chat.viazapi.tech` | Chatwoot do ViaZapi |
| `VIAZAPI_TOKEN` | (Perfil → Token de acesso) | API do Chatwoot |
| `VIAZAPI_ACCOUNT_ID` / `VIAZAPI_INBOX_ID` | `1` / `4` | Conta e caixa do WhatsApp |
| `PUBLIC_URL` | `https://sincerusscale.com.br` | Link público temporário do PDF (exigido pelo modelo da Meta) |
| `WA_TEMPLATE_REPORT` | `relatorio_sincerus` | Modelo aprovado com **documento no cabeçalho**; corpo `{{1}}` nome, `{{2}}` relatório, `{{3}}` período |
| `WA_TEMPLATE_ALERT` | `alerta_sincerus` | Modelo aprovado de texto; corpo `{{1}}` = resumo em uma linha |
| `WA_TEMPLATE_DIGEST` | `diario_sincerus` | Prefixo dos modelos `diario_sincerus_1` … `_10`: "Diário Sincerus - Resumo ({{1}})" + "Informações importantes" + um cliente por linha. O sistema escolhe o modelo pelo número de linhas (acima de 10, a última vira "e mais N"). Só preencha depois de aprovados; sem ele, usa o `WA_TEMPLATE_ALERT` |
| `JOB_SECRET` | texto aleatório (24+ caracteres) | Protege `/api/jobs/run` |
| `REPORT_EXCLUDE` | `DS AUTOS,VIAZAPI,Zion,Kaio Triani` | Contas fora dos envios (nome ou ID) |

Regra da Meta: mensagem livre só é entregue se a pessoa escreveu para o número nas últimas 24h; fora disso, o sistema usa os modelos acima.

### Cron da Hostinger (garante que rode mesmo se o processo dormir)

hPanel → Avançado → Cron Jobs, a cada 5 minutos:

```
curl -s "https://sincerusscale.com.br/api/jobs/run?job=tick&key=SEU_JOB_SECRET" > /dev/null
```

O `tick` só roda o que está no horário e nunca repete um envio. Para testar sem enviar: `/api/jobs/run?job=weekly&dry=1&key=...` (gera os PDFs em `server/data/`).
