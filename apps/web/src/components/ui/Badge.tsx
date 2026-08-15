type BadgeVariant =
  | 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled' | 'rejected'
  | 'verified' | 'on_time' | 'late' | 'unknown'
  | 'synced' | 'pending_sync' | 'conflict'
  | 'valid' | 'invalid' | 'expired';

const styles: Record<BadgeVariant, string> = {
  active:       'bg-teal-50 text-teal-700 border-teal-200',
  verified:     'bg-teal-50 text-teal-700 border-teal-200',
  synced:       'bg-teal-50 text-teal-700 border-teal-200',
  valid:        'bg-teal-50 text-teal-700 border-teal-200',
  on_time:      'bg-teal-50 text-teal-700 border-teal-200',
  completed:    'bg-blue-50 text-blue-700 border-blue-200',
  pending:      'bg-amber-50 text-amber-700 border-amber-200',
  pending_sync: 'bg-amber-50 text-amber-700 border-amber-200',
  unknown:      'bg-amber-50 text-amber-700 border-amber-200',
  late:         'bg-red-50 text-red-600 border-red-200',
  rejected:     'bg-red-50 text-red-600 border-red-200',
  cancelled:    'bg-red-50 text-red-600 border-red-200',
  invalid:      'bg-red-50 text-red-600 border-red-200',
  expired:      'bg-red-50 text-red-600 border-red-200',
  conflict:     'bg-red-50 text-red-600 border-red-200',
  inactive:     'bg-slate-100 text-slate-500 border-slate-200',
};

const labels: Partial<Record<BadgeVariant, string>> = {
  on_time:      'On Time',
  pending_sync: 'Pending Sync',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: string;
  variant?: string;
}

export function Badge({ status, variant, className = '', children, ...props }: BadgeProps) {
  if (status) {
    const style = styles[status as BadgeVariant] ?? 'bg-slate-100 text-slate-500 border-slate-200';
    const label = labels[status as BadgeVariant] ?? status;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${style} ${className}`} {...props}>
        {children || label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-slate-200 bg-slate-100 text-slate-700 ${className}`} {...props}>
      {children}
    </span>
  );
}

export default Badge;
