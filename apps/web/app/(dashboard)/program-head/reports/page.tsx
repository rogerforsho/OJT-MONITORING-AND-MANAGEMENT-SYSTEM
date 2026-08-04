import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/services/auth';
import { createClient } from '@/src/lib/supabase/server';

async function getProgramHeadOverview() {
  const supabase = await createClient();

  const [{ data: totalReports }, { data: approvedReports }, { data: pendingReports }, { data: rejectedReports }, { data: recentReports }] = await Promise.all([
    supabase.from('reports').select('report_id', { count: 'exact' }),
    supabase.from('reports').select('report_id', { count: 'exact' }).eq('status', 'approved'),
    supabase.from('reports').select('report_id', { count: 'exact' }).in('status', ['submitted', 'reviewed']),
    supabase.from('reports').select('report_id', { count: 'exact' }).eq('status', 'rejected'),
    supabase
      .from('reports')
      .select('report_id, report_type, status, submission_date, students ( student_number, users ( full_name ) )')
      .order('submission_date', { ascending: false })
      .limit(8),
  ]);

  return {
    totalReports: totalReports?.length ?? 0,
    approvedReports: approvedReports?.length ?? 0,
    pendingReports: pendingReports?.length ?? 0,
    rejectedReports: rejectedReports?.length ?? 0,
    recentReports: recentReports ?? [],
  };
}

export default async function ProgramHeadReportsPage() {
  const user = await getAuthUser();

  if (!user || user.role !== 'ProgramHead') redirect('/dashboard');

  const overview = await getProgramHeadOverview();

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Program Head Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Track report submissions and keep oversight of student requirements.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total reports</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.totalReports}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-sm text-emerald-700">Approved</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-900">{overview.approvedReports}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-sm text-amber-700">Pending review</p>
          <p className="mt-2 text-2xl font-semibold text-amber-900">{overview.pendingReports}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-sm text-rose-700">Rejected</p>
          <p className="mt-2 text-2xl font-semibold text-rose-900">{overview.rejectedReports}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent submissions</h2>
          <Link href="/coordinator/submissions" className="text-sm font-medium text-teal-700 hover:underline">View coordinator queue</Link>
        </div>

        <div className="mt-4 space-y-3">
          {overview.recentReports.length === 0 ? (
            <p className="text-sm text-slate-500">No reports have been submitted yet.</p>
          ) : (
            overview.recentReports.map((report: any) => (
              <div key={report.report_id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{report.report_type}</p>
                  <p className="text-sm text-slate-500">{report.students?.users?.full_name ?? 'Student'} • {report.students?.student_number ?? 'N/A'}</p>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                  report.status === 'approved'
                    ? 'bg-emerald-50 text-emerald-700'
                    : report.status === 'rejected'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700'
                }`}>
                  {report.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
