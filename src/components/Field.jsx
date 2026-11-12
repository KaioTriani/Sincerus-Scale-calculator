import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

// Campo com rótulo flutuante, ícone, estado válido/erro e mensagem animada
export default function Field({ label, icon: Icon, type = 'text', value, onChange, error, valid, hint, autoComplete, name, id }) {
  const [show, setShow] = useState(false);
  const [focus, setFocus] = useState(false);
  const isPw = type === 'password';
  const filled = value.length > 0;
  const inputId = id ?? name;
  const state = error ? 'border-rose-400/60 bg-rose-400/[0.04]' : valid ? 'border-emerald-400/40' : focus ? 'border-brand/60' : 'border-white/10';

  return (
    <div>
      <div className={`group relative flex items-center rounded-2xl border bg-white/[0.03] transition-all duration-300 ${state} ${focus ? 'shadow-[0_0_0_4px_rgba(247,96,0,0.10)]' : ''}`}>
        {Icon && <Icon className={`ml-4 h-[18px] w-[18px] shrink-0 transition-colors ${focus ? 'text-brand-300' : 'text-white/40'}`} />}
        <div className="relative flex-1">
          <label
            htmlFor={inputId}
            className={`pointer-events-none absolute left-3 transition-all duration-200 ${focus || filled ? 'top-2 text-[10.5px] font-semibold uppercase tracking-wider text-white/45' : 'top-1/2 -translate-y-1/2 text-sm text-white/50'}`}
          >
            {label}
          </label>
          <input
            id={inputId}
            name={name}
            type={isPw && !show ? 'password' : isPw ? 'text' : type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            autoComplete={autoComplete}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-err` : undefined}
            className="w-full bg-transparent px-3 pb-2.5 pt-6 text-[15px] text-white outline-none placeholder:text-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        {isPw ? (
          <button type="button" onClick={() => setShow((s) => !s)} className="mr-2 rounded-full p-2 text-white/45 transition hover:bg-white/5 hover:text-white" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : (
          <span className="mr-4 w-4">
            {valid && !error && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          </span>
        )}
      </div>
      <AnimatePresence initial={false}>
        {(error || hint) && (
          <motion.p
            id={`${inputId}-err`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`flex items-center gap-1.5 overflow-hidden px-2 pt-1.5 text-xs ${error ? 'text-rose-300' : 'text-white/45'}`}
          >
            {error && <AlertCircle className="h-3.5 w-3.5" />}
            {error || hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
