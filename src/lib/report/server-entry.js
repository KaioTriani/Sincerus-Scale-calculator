// Ponto de entrada para usar os geradores de relatório no servidor (Node), sem navegador.
// Empacotado pelo Vite em dist-server/reports.mjs (vite.server.config.js).
export { computeClientReport, draftTexts, buildClientReportHtml, buildClientReportsHtml } from './clientReport';
export { buildBalancesHtml, classify as classifyBalance } from './balancesHtml';
export { buildActiveAdsHtml, activeAdsText, clientAdList } from './activeAdsHtml';
export { draftToReport } from './build';
export { compute, isActive } from './compute';
export { buildReportHtml, reportCss } from './html';
export { identifyCar } from './parse';
