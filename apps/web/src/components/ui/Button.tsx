export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'gold' | 'ghost' | 'outline' | 'secondary' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function Button({ loading, variant = 'primary', size = 'default', children, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] select-none disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer';

  const sizes = {
    default: 'px-5 py-2.5 text-sm',
    sm: 'px-3.5 py-1.5 text-xs',
    lg: 'px-6 py-3 text-base',
    icon: 'h-9 w-9 p-0',
  };

  const variants = {
    primary: 'bg-[#0A3D24] text-white hover:bg-[#062415] hover:shadow-xs focus:ring-2 focus:ring-[#0A3D24]/30 focus:ring-offset-1 border border-emerald-900/40 shadow-xs',
    gold: 'bg-[#F59E0B] text-[#062415] hover:bg-[#D97706] hover:text-white hover:shadow-xs focus:ring-2 focus:ring-amber-500/30 focus:ring-offset-1 font-bold shadow-xs',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100/90 hover:text-slate-900 focus:ring-2 focus:ring-slate-300',
    outline: 'bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 focus:ring-2 focus:ring-slate-300 shadow-xs',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200/80 hover:text-slate-950 focus:ring-2 focus:ring-slate-300 shadow-xs',
    destructive: 'bg-rose-600 text-white hover:bg-rose-700 hover:shadow-xs focus:ring-2 focus:ring-rose-500/30 border border-rose-700/40 shadow-xs',
  };

  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

export default Button;
