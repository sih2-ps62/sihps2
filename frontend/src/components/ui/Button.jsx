const variants = {
  primary: "bg-accent text-white hover:bg-accent/90",
  ghost: "border border-border bg-surface text-text-primary hover:bg-accent-soft",
  critical: "bg-status-critical text-white hover:bg-status-critical/90",
};

export default function Button({ variant = "primary", icon: Icon, children, className = "", ...rest }) {
  return (
    <button
      type="button"
      className={`focus-ring flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={16} strokeWidth={2} />}
      {children}
    </button>
  );
}
