# Sincerus Scale — Simulador de investimento

Projeto do simulador Sincerus Scale preparado para deploy pela Hostinger via GitHub.

## Contatos oficiais

- Instagram: https://www.instagram.com/sincerus.rico/
- WhatsApp: +55 83 99905-4165

Todos os botões de WhatsApp usam o mesmo número oficial e geram uma mensagem personalizada com os dados preenchidos pelo cliente e com os números da projeção.

## Personalização da mensagem

Antes de abrir o WhatsApp, o cliente informa:

- Nome
- Nome da loja

A mensagem inclui automaticamente:

- Nome e loja
- Investimento mensal
- Cenário base
- Conversas estimadas
- Conversas por dia
- CAC em mídia
- Margem por aparelho, quando informada
- Lucro bruto
- Lucro líquido
- ROAS
- Cashback, caso o cliente já tenha girado a roleta

Se nome ou loja estiverem vazios, o botão do WhatsApp não abre e o site leva o cliente aos campos obrigatórios.

## Nomenclaturas financeiras

Os rótulos usados são:

- **Lucro bruto**
- **Lucro líquido**

As fórmulas permanecem:

- Lucro bruto = vendas estimadas no cenário Base × margem por aparelho
- Lucro líquido = lucro bruto − investimento em mídia
- ROAS = lucro bruto ÷ investimento em mídia

## Deploy na Hostinger via GitHub

O repositório agora inclui `package.json` e configuração Vite para que o fluxo **Deploy Web App → Import Git Repository** da Hostinger reconheça o projeto.

Configuração:

- Repositório: `KaioTriani/Sincerus-Scale-calculator`
- Branch: `main`
- Node.js: `20.x`
- Build command: `npm run build`
- Output directory: `dist`
- Start command, se o painel solicitar: `npm start`

### Se a Hostinger mostrar “Implante como estático”

Também é válido usar essa opção, pois o produto final é um site HTML/CSS/JavaScript estático.

Para hospedagem estática tradicional:

- Branch: `main`
- Arquivo inicial: `index.html`
- Pasta de destino: `public_html`

## Estrutura

- `index.html` — página e campos do cliente
- `styles.css` — identidade visual e responsividade
- `app.js` — cálculos, roleta e mensagem personalizada do WhatsApp
- `package.json` — scripts e dependências para a Hostinger
- `vite.config.js` — build para `dist`
- `.gitignore` — arquivos locais ignorados
