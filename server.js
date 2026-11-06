// Arquivo de entrada da aplicação Node (Hostinger: "Arquivo de entrada" = server.js; ou "npm start").
// Sem top-level await: funciona também quando o painel carrega o arquivo via require().
import './server/env.mjs'; // precisa vir primeiro: carrega o .env local antes do servidor ler as variáveis
import './server/index.mjs';
