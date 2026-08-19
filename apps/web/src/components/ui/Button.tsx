export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'gold' | 'ghost' | 'outline' | 'secondary' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function Button({ loading, variant = 'primary', size = 'default', children, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer';

  const sizes = {
    default: 'px-5 py-2.5 text-sm',
    sm: 'px-3.5 py-1.5 text-xs',
    lg: 'px-6 py-3 text-base',
    icon: 'h-9 w-9 p-0',
  };

  const variants = {
    primary: 'bg-[#0A3D24] text-white hover:bg-[#062415] focus:ring-[#FFCC00] border border-[#FFCC00]/30 shadow-md shadow-[#0A3D24]/20',
    gold: 'bg-[#FFCC00] text-[#062415] hover:bg-[#f0c000] focus:ring-[#0A3D24] shadow-md shadow-[#FFCC00]/30',
    ghost: 'bg-transparent text-[#0A3D24] hover:bg-[#0A3D24]/10 focus:ring-[#0A3D24]',
    outline: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 focus:ring-slate-400',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-300',
    destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-md shadow-red-600/20',
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
