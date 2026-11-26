import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:
    'bg-linear-to-b from-brand-400 to-brand-600 text-white shadow-glow hover:from-brand-300 hover:to-brand-500',
  ghost: 'border border-white/10 bg-white/[0.04] text-white/90 backdrop-blur-xl hover:border-white/25 hover:bg-white/[0.08]',
  subtle: 'text-white/70 hover:bg-white/[0.06] hover:text-white',
};

// Com `href` vira link (<a>) com o mesmo visual — evita botão dentro de link
export default function Button({ variant = 'primary', loading = false, icon: Icon, iconRight: IconRight, className = '', children, disabled, ...props }) {
  const Tag = props.href ? motion.a : motion.button;
  return (
    <Tag
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
      {...(props.href ? {} : { disabled: loading || disabled })}
    >
      {variant === 'primary' && (
        // reflexo que atravessa o botão no hover
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      )}
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      <span className="relative">{children}</span>
      {IconRight && !loading && <IconRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
    </Tag>
  );
}
