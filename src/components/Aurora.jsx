// Fundo vivo: manchas de luz laranja à deriva + grade em perspectiva que some nas bordas
export default function Aurora({ grid = true }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-[10%] top-[-20%] h-[60vmax] w-[60vmax] animate-drift rounded-full bg-brand/20 blur-[120px]" />
      <div className="absolute -right-[15%] top-[10%] h-[45vmax] w-[45vmax] animate-drift-slow rounded-full bg-brand-700/25 blur-[140px]" />
      <div className="absolute bottom-[-30%] left-[30%] h-[40vmax] w-[40vmax] animate-drift rounded-full bg-orange-300/10 blur-[120px]" />
      {grid && (
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)',
          }}
        />
      )}
    </div>
  );
}
