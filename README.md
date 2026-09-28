# Sincerus Scale — Simulador de investimento

Projeto estático e pronto para hospedagem do simulador Sincerus Scale.

## Nomenclaturas financeiras

Foram usados estes rótulos na seção financeira:

- **Lucro bruto**
- **Lucro líquido**

As fórmulas permanecem:

- Lucro bruto = vendas estimadas no cenário Base × margem por aparelho
- Lucro líquido = lucro bruto − investimento em mídia
- ROAS = lucro bruto ÷ investimento em mídia

## Deploy na Hostinger via GitHub

O projeto é 100% estático. Não precisa de Node.js, banco de dados, variáveis de ambiente ou comando de build.

Use:

- Repositório: `KaioTriani/Sincerus-Scale-calculator`
- Branch: `main`
- Build command: nenhum
- Arquivo inicial: `index.html`
- Diretório público: raiz do projeto (ou o diretório que a Hostinger mapear para `public_html`)

### Passos gerais

1. No hPanel da Hostinger, abra o site/domínio.
2. Entre na área de Git/Deploy pelo GitHub.
3. Conecte sua conta do GitHub.
4. Selecione `KaioTriani/Sincerus-Scale-calculator`.
5. Selecione a branch `main`.
6. Não configure comando de build.
7. Publique a raiz do repositório.

## Estrutura

- `index.html` — página do simulador
- `styles.css` — identidade visual e responsividade
- `app.js` — cálculos e interações
- `.gitignore` — arquivos locais ignorados

## Observação sobre os links de contato

Os botões de Instagram e WhatsApp estão funcionais como links, porém usam destinos genéricos no código. Substitua-os pelos links oficiais da Sincerus no `index.html` caso deseje apontar para os perfis definitivos.
