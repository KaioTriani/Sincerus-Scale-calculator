# Sincerus Scale — Calculadora

## Página exclusiva para tráfego do TikTok

Acesse `/roleta/` no mesmo domínio. A página tem uma entrada HTML própria, funciona ao abrir o link diretamente ou atualizar a página e não depende de redirecionamento de SPA. Não há links no simulador apontando para ela. Inclui `noindex, nofollow`; é uma página pública não listada, não uma área com autenticação.

São oito setores elegíveis: quatro de R$ 200 e quatro de R$ 300. Os dois valores têm chances iguais. O prêmio fica guardado neste navegador e segue na mensagem do WhatsApp. O armazenamento local evita novos giros casuais, mas não é um sistema de validação de resgates; a equipe confirma a utilização pelo WhatsApp. Não há cobrança para girar.

Site completo em React + Vite, responsivo, com simulação em tempo real, roleta e resumo para WhatsApp. Não exige banco de dados, chaves de API ou serviços da hospedagem anterior.

## Importar na Hostinger

No hPanel: **Sites → Adicionar site → Aplicativo web Node.js → Importar do GitHub**. Selecione este repositório e a branch **main**. Requer um plano com Aplicativos web Node.js (Business ou Cloud, conforme disponibilidade na conta).

Configuração de build:

| Campo | Valor |
|---|---|
| Framework | Vite |
| Node.js | 22 (22.13 ou superior) |
| Diretório raiz | ./ |
| Gerenciador | npm |
| Instalação | npm install |
| Build | npm run build |
| Diretório de saída | dist |
| Variáveis de ambiente | Nenhuma |

O resultado é estático: a Hostinger serve o diretório dist, sem servidor Node permanente. Não use a integração Git de hospedagem PHP para publicar o código-fonte sem executar o build. Alternativa: executar o build local e enviar o conteúdo de dist para public_html.

Guia oficial: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/

## Rodar localmente

Instale Node.js 22.13+; execute npm install, npm run dev. Para produção: npm run build. Para verificar: npm test e npm run preview.

## Estrutura

- components: SplashScreen, Header, Simulador, FinanceResults, RoletaCashback e WhatsAppButton.
- lib/simulation.ts: cálculos e sorteio.
- lib/whatsapp.ts: mensagem e URL Encoding.
- lib/brand.ts: contatos e identidade da marca.
- app/globals.css: estilos responsivos.
- public: logo e favicon.

## Nomes dos indicadores

Somente os rótulos foram alterados: Margem acumulada → Lucro bruto; Lucro após mídia → Lucro líquido. As fórmulas permanecem idênticas: bruto = vendas estimadas × margem por aparelho; líquido = bruto − investimento em anúncios; ROAS do modelo = bruto ÷ investimento. O modelo não desconta outras despesas da loja automaticamente.

Mínimo de R$ 1.500; seis valores distintos de cashback entre R$ 400 e R$ 500, exibidos no pop-up ao avançar para o WhatsApp. O sorteio ocorre no navegador; não há registro persistente de resgates. WhatsApp: +55 (83) 99905-4165.
