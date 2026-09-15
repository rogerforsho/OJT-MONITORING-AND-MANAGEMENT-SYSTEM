type BadgeVariant =
  | 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled' | 'rejected'
  | 'verified' | 'on_time' | 'late' | 'unknown'
  | 'synced' | 'pending_sync' | 'conflict'
  | 'valid' | 'invalid' | 'expired';

const styles: Record<BadgeVariant, { pill: string; dot: string }> = {
  active:       { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' },
  verified:     { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' },
  synced:       { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' },
  valid:        { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' },
  on_time:      { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' },
  completed:    { pill: 'bg-sky-50 text-sky-700 border-sky-200/80', dot: 'bg-sky-500' },
  pending:      { pill: 'bg-amber-50 text-amber-800 border-amber-200/80', dot: 'bg-amber-500' },
  pending_sync: { pill: 'bg-amber-50 text-amber-800 border-amber-200/80', dot: 'bg-amber-500' },
  unknown:      { pill: 'bg-amber-50 text-amber-800 border-amber-200/80', dot: 'bg-amber-500' },
  late:         { pill: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500' },
  rejected:     { pill: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500' },
  cancelled:    { pill: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500' },
  invalid:      { pill: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500' },
  expired:      { pill: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500' },
  conflict:     { pill: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500' },
  inactive:     { pill: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

const labels: Partial<Record<BadgeVariant, string>> = {
  on_time:      'On Time',
  pending_sync: 'Pending Sync',
  pending:      'Pending Review',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: string;
  variant?: string;
}

export function Badge({ status, variant, className = '', children, ...props }: BadgeProps) {
  const activeKey = (status || variant) as BadgeVariant | undefined;
  if (activeKey) {
    const item = styles[activeKey] ?? {
      pill: 'bg-slate-100 text-slate-600 border-slate-200',
      dot: 'bg-slate-400',
    };
    const label = labels[activeKey] ?? activeKey.replace(/_/g, ' ');
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${item.pill} ${className}`} {...props}>
        <span className={`w-1.5 h-1.5 rounded-full ${item.dot} shrink-0`} />
        <span>{children || label}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border border-slate-200 bg-slate-100 text-slate-700 ${className}`} {...props}>
      {children}
    </span>
  );
}

export default Badge;
