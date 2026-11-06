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
| Comando de build | `npm run build` |
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
