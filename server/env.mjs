// Carrega o .env local, se existir. Na Hostinger, as variáveis vêm do painel e este arquivo não existe.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../.env', import.meta.url));
if (fs.existsSync(file)) process.loadEnvFile(file);
