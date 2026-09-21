import { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = '', ...props }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={inputId} className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all shadow-2xs
            focus:ring-2 focus:ring-[#0A3D24]/20 dark:focus:ring-emerald-500/30 focus:border-[#0A3D24] dark:focus:border-emerald-500
            ${error ? 'border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200' : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'} ${className}`}
          {...props}
        />
        {error && <p className="text-xs font-medium text-rose-500 dark:text-rose-400">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
export default Input;
