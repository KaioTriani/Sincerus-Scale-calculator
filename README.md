# Sincerus Scale — Calculadora e roleta

Projeto preparado para importação do GitHub pela Hostinger.

## Endereços

- `https://sincerusscale.com.br/`: simulador principal.
- `https://sincerusscale.com.br/roleta/`: roleta independente.

`/roleta/` é um caminho no mesmo domínio, não um subdomínio. Não precisa criar outro registro DNS. A página não aparece nos menus ou links do simulador. O HTML contém `noindex, nofollow`, mas a URL é pública: qualquer pessoa que conheça o endereço pode abri-la.

## Publicar na Hostinger

No hPanel, use **Adicionar site → Aplicativo web Node.js / Deploy Web App → Importar do GitHub**, selecione este repositório e a branch **main**. Se já houver uma aplicação conectada a este repositório, faça um novo deploy.

| Configuração | Valor |
|---|---|
| Framework | Vite |
| Node.js | 22 (22.13 ou superior) |
| Diretório raiz | ./ |
| Gerenciador | npm |
| Instalação | npm install |
| Build | npm run build |
| Pasta de saída | dist |
| Variáveis de ambiente | Nenhuma |

Associe a aplicação ao domínio `sincerusscale.com.br` no painel. O plano precisa oferecer importação de aplicações Node.js. O build é estático; não é necessário servidor Node permanente para atender as páginas.

O build gera **dist/index.html** e **dist/roleta/index.html**. Não configure a pasta raiz do projeto como `roleta`: isso publicaria somente a roleta na raiz do domínio.

Se usar hospedagem de arquivos estáticos, envie o conteúdo completo de `dist` para `public_html`, preservando `assets` e `roleta`. Abrir diretamente `/roleta/` funciona sem roteador React ou regras especiais de SPA.

Guia oficial: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/

## Código da roleta

**O arquivo ativo é `roleta/index.html`**, uma cópia completa de `roleta_sincerus_animacao_melhorada.html`, com CSS e JavaScript embutidos. Ele usa Web Animations API, tem aceleração contínua, desaceleração progressiva, ponteiro sincronizado e destaque do setor ao terminar.

O HTML informa que somente R$ 200 e R$ 300 são resultados disponíveis; os demais setores permanecem identificados como ilustrativos. O resultado e a participação são registrados no navegador. Esse controle e o fingerprint básico não são validação antifraude no servidor e não garantem unicidade por aparelho.

O arquivo mantém o comportamento original de abrir o WhatsApp após o resultado: `AUTO_REDIRECT = true`, com atraso de 2500 ms. O botão também permite continuar manualmente. Para usar somente o botão, altere essa constante para `false`.

Os antigos `components/CampaignWheel.tsx`, `lib/campaign*.ts` e `roleta/main.tsx` foram preservados como código anterior, mas não são carregados por esta página. Não é necessário editá-los para alterar a roleta atual.

## Desenvolvimento

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

Use `/roleta/` no servidor local para abrir a campanha. O simulador continua em `/`.

## Simulador principal

Mantém a calculadora, splash, modal próprio de cashback e WhatsApp. Os nomes financeiros são **Lucro bruto** e **Lucro líquido**, com as fórmulas originais preservadas: bruto = vendas estimadas × margem por aparelho; líquido = bruto − investimento em anúncios; ROAS do modelo = bruto ÷ investimento. Outras despesas não são descontadas automaticamente.

WhatsApp comercial: +55 (83) 99905-4165.
