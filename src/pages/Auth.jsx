import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Lock, User, ArrowRight, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo';
import Button from '../components/Button';
import Field from '../components/Field';
import Aurora from '../components/Aurora';
import Sparkline from '../components/Sparkline';
import { useAuth } from '../lib/auth';

export default function Auth({ mode }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Validação em tempo real: o erro aparece depois que o campo recebeu algo (ou no envio)
  const errors = useMemo(() => {
    const e = {};
    if (!/^[a-z]+\.[a-z]+$/i.test(username.trim())) e.username = 'Use o formato nome.sobrenome.';
    if (!password) e.password = 'Digite sua senha.';
    return e;
  }, [username, password]);
  const show = (k) => (touched[k] ? errors[k] : undefined);
  const set = (k, fn) => (v) => { fn(v); setTouched((t) => ({ ...t, [k]: true })); setFormError(''); };

  const submit = async (ev) => {
    ev.preventDefault();
    setTouched({ username: true, password: true });
    if (errors.username || errors.password) return;
    setLoading(true);
    try {
      await login(username, password, remember);
      navigate(location.state?.from ?? '/dashboard', { replace: true });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-[100svh] lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca (desktop) */}
      <aside className="relative hidden overflow-hidden border-r border-white/[0.06] lg:block">
        <Aurora />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/"><Logo size={32} /></Link>
          <div>
            <motion.img
              src="/logo-mark.png"
              alt=""
              initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="h-28 w-auto drop-shadow-[0_0_50px_rgba(247,96,0,0.55)]"
            />
            <h2 className="mt-10 max-w-md text-5xl font-extrabold leading-[1.05]">
              <span className="text-gradient">Performance</span> <span className="text-brand-gradient">sem ruído.</span>
            </h2>
            <p className="mt-5 max-w-sm text-white/55">Toda a carteira de clientes, campanhas e resultados em um só painel.</p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass mt-10 max-w-sm p-5">
              <div className="flex items-center justify-between text-xs text-white/50"><span>Resultados · últimos 6 meses</span><span className="text-emerald-300">+50%</span></div>
              <div className="mt-3"><Sparkline data={[820, 905, 990, 1062, 1140, 1230]} width={300} height={60} /></div>
            </motion.div>
          </div>
          <p className="text-xs text-white/35">© 2026 Sincerus Scale · Uso interno</p>
        </div>
      </aside>

      {/* Formulário */}
      <section className="relative flex items-center justify-center px-5 py-12">
        <div className="absolute inset-0 lg:hidden"><Aurora /></div>
        <motion.div layout className="glass-strong relative w-full max-w-md p-7 sm:p-9">
          <Link to="/" className="mb-8 inline-block lg:hidden"><Logo size={28} /></Link>

          <AnimatePresence mode="wait">
            {mode === 'forgot' ? (
              <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <span className="mb-5 grid h-12 w-12 place-items-center rounded-2xl border border-brand/30 bg-brand/10"><KeyRound className="h-5 w-5 text-brand-300" /></span>
                <h1 className="text-2xl font-bold sm:text-3xl">Esqueceu a senha?</h1>
                <p className="mt-3 text-sm leading-relaxed text-white/55">
                  Este é um sistema interno com acessos fixos. Para redefinir sua senha, fale com o administrador do sistema.
                </p>
                <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/login')} className="mt-8 w-full">Voltar para o login</Button>
              </motion.div>
            ) : (
              <motion.form key="login" onSubmit={submit} noValidate initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35 }}>
                <span className="eyebrow"><ShieldCheck className="h-3.5 w-3.5" /> Acesso restrito</span>
                <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Bem-vindo de volta</h1>
                <p className="mt-2 text-sm text-white/55">Entre com seu usuário Sincerus.</p>

                <div className="mt-7 space-y-3.5">
                  <Field name="username" label="Usuário (nome.sobrenome)" icon={User} value={username} onChange={set('username', setUsername)} error={show('username')} valid={!errors.username} autoComplete="username" />
                  <Field name="password" label="Senha" type="password" icon={Lock} value={password} onChange={set('password', setPassword)} error={show('password')} autoComplete="current-password" />
                </div>

                <div className="mt-5 flex items-center justify-between text-sm">
                  <label className="flex cursor-pointer select-none items-center gap-2.5 text-white/65">
                    <button type="button" role="switch" aria-checked={remember} onClick={() => setRemember((r) => !r)} className={`relative h-5 w-9 rounded-full transition-colors ${remember ? 'bg-brand' : 'bg-white/15'}`}>
                      <motion.span layout className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow ${remember ? 'right-0.5' : 'left-0.5'}`} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                    </button>
                    Lembrar-me
                  </label>
                  <Link to="/recuperar" className="text-brand-300 transition hover:text-brand-400">Esqueci a senha</Link>
                </div>

                <AnimatePresence>
                  {formError && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                      {formError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <Button type="submit" loading={loading} iconRight={ArrowRight} className="mt-6 w-full py-3.5 text-[15px]">Entrar</Button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </section>
    </div>
  );
}
