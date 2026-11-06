import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { LayoutDashboard, Users, Calculator, LogOut, Bell, Search, ChevronDown, FileBarChart, PlugZap } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/data';
import { metaAvailable } from '../lib/api';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/relatorios', label: 'Relatórios', icon: FileBarChart },
  { to: '/calculadora/', label: 'Calculadora', icon: Calculator, external: true },
];

function NavItem({ to, label, icon: Icon, compact, external }) {
  if (external) {
    // página própria (fora do app React): navegação completa
    return (
      <a href={to} className={`relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white/55 transition-colors hover:text-white ${compact ? 'flex-col gap-1 px-2 py-2 text-[11px]' : ''}`}>
        <Icon className="h-[18px] w-[18px]" /><span>{label}</span>
      </a>
    );
  }
  return (
    <NavLink to={to} end className="relative block">
      {({ isActive }) => (
        <span className={`relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${compact ? 'flex-col gap-1 px-2 py-2 text-[11px]' : ''} ${isActive ? 'text-white' : 'text-white/55 hover:text-white'}`}>
          {isActive && (
            <motion.span layoutId={compact ? 'nav-pill-m' : 'nav-pill'} className="absolute inset-0 rounded-2xl border border-brand/30 bg-linear-to-r from-brand/20 to-brand/5" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
          )}
          <Icon className={`relative h-[18px] w-[18px] ${isActive ? 'text-brand-300' : ''}`} />
          <span className="relative">{label}</span>
        </span>
      )}
    </NavLink>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [meta, setMeta] = useState(null);
  useEffect(() => { metaAvailable().then(setMeta); }, []);
  const out = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <div className="relative min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/[0.06] bg-carbon-950/60 p-5 backdrop-blur-2xl lg:flex">
        <Logo size={30} className="px-2 py-1" />
        <nav className="mt-10 space-y-1.5">
          {NAV.map((n) => <NavItem key={n.to} {...n} />)}
        </nav>
        <div className="mt-auto glass p-4">
          <p className="flex items-center gap-2 text-xs text-white/50"><PlugZap className="h-3.5 w-3.5" /> Meta Ads</p>
          {meta?.configured ? (
            <>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" /> API conectada</p>
              <p className="mt-1 text-xs leading-relaxed text-white/45">Dados reais das contas de anúncio.</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm font-semibold">API não configurada</p>
              <p className="mt-1 text-xs leading-relaxed text-white/45">Painéis em modo demonstração; relatórios por importação.</p>
            </>
          )}
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-carbon-950/55 backdrop-blur-2xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
            <Logo size={26} withText={false} className="lg:hidden" />
            <label className="relative hidden flex-1 sm:block sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input placeholder="Buscar clientes, campanhas…" className="w-full rounded-full border border-white/10 bg-white/[0.04] py-2 pl-10 pr-4 text-sm outline-none transition placeholder:text-white/35 focus:border-brand/50" />
            </label>
            <div className="ml-auto flex items-center gap-2">
              <button className="relative rounded-full border border-white/10 bg-white/[0.04] p-2.5 text-white/70 transition hover:text-white" aria-label="Notificações">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand shadow-[0_0_10px_#F76000]" />
              </button>
              <div className="relative">
                <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 transition hover:border-white/20">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-linear-to-br from-brand-400 to-brand-700 text-xs font-bold">{initials(user?.name ?? 'S')}</span>
                  <span className="hidden text-sm font-medium sm:block">{user?.name?.split(' ')[0]}</span>
                  <ChevronDown className={`h-4 w-4 text-white/50 transition ${menu ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {menu && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      className="glass-strong absolute right-0 mt-2 w-60 p-2"
                    >
                      <div className="px-3 py-2">
                        <p className="text-sm font-semibold">{user?.name}</p>
                        <p className="truncate text-xs text-white/50">{user?.username}</p>
                      </div>
                      <button onClick={out} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-rose-300 transition hover:bg-rose-400/10">
                        <LogOut className="h-4 w-4" /> Sair
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12">{children}</main>
      </div>

      {/* Navegação inferior (mobile/tablet) */}
      <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-4 gap-1 rounded-3xl border border-white/10 bg-carbon-900/80 p-1.5 shadow-glass backdrop-blur-2xl lg:hidden">
        {NAV.map((n) => <NavItem key={n.to} {...n} compact />)}
      </nav>
    </div>
  );
}
