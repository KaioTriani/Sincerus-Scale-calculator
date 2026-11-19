export default function Logo({ size = 34, withText = true, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img src="/logo-mark.png" alt="" width={size} height={size} className="drop-shadow-[0_0_14px_rgba(247,96,0,0.45)]" style={{ height: size, width: 'auto' }} />
      {withText && (
        <span className="font-display text-[17px] font-extrabold tracking-[0.22em] text-white">
          SINCERUS
        </span>
      )}
    </span>
  );
}
