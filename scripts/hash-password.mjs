// Gera o hash de uma senha para a variável AUTH_USERS.
// Uso: node scripts/hash-password.mjs "nome.sobrenome" "Nome Completo" "SENHA"
import { hashPassword } from '../server/auth.mjs';

const [username, name, password] = process.argv.slice(2);
if (!username || !name || !password) {
  console.error('Uso: node scripts/hash-password.mjs "nome.sobrenome" "Nome Completo" "SENHA"');
  process.exit(1);
}
console.log(JSON.stringify({ username: username.toLowerCase(), name, hash: hashPassword(password) }));
