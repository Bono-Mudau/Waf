export default function Button({
  text,
  children,
  busy = false,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled,
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`Button button-${variant} ${className}`}
    >
      {busy && <span className="spinner spinner-small" aria-hidden="true" />}
      {children || text}
    </button>
  );
}
