import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from './lib/auth';
import AppShell from './components/AppShell';
import Landing from './pages/Landing';
import Auth from './pages/Auth';

// Telas internas (com Recharts) carregadas sob demanda: a landing e o login abrem mais rápido
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const Reports = lazy(() => import('./pages/Reports'));

const Loading = () => (
  <div className="grid min-h-[60vh] place-items-center">
    <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-brand" />
  </div>
);

// Transição entre telas: fade + deslize, estilo corte de cena.
// Sem "filter" aqui: ele criaria um bloco de contenção e quebraria elementos "fixed" (nav, drawer).
function Page({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Protected({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AppShell><Suspense fallback={<Loading />}>{children}</Suspense></AppShell>;
}

export default function App() {
  const location = useLocation();
  const { user, checking } = useAuth();
  if (checking && location.pathname !== '/') return <Loading />;
  return (
    <div className="grain">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Page><Landing /></Page>} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Page><Auth mode="login" /></Page>} />
          <Route path="/recuperar" element={<Page><Auth mode="forgot" /></Page>} />
          <Route path="/dashboard" element={<Protected><Page><Dashboard /></Page></Protected>} />
          <Route path="/clientes" element={<Protected><Page><Clients /></Page></Protected>} />
          <Route path="/relatorios" element={<Protected><Page><Reports /></Page></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}
