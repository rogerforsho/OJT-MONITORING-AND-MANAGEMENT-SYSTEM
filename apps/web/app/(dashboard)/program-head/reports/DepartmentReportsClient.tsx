'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Users, Building, GraduationCap, Clock, Search, FileSpreadsheet } from '@/src/components/ui/Icons';
import type { StudentProgressDetail } from '@/src/services/progress';

interface Props {
  summary: {
    totalStudents: number;
    activeTrainees: number;
    completedTrainees: number;
    totalRenderedHours: number;
    departmentCounts: Record<string, { total: number; completed: number; hours: number }>;
  };
  initialStudents: StudentProgressDetail[];
}

export default function DepartmentReportsClient({ summary, initialStudents }: Props) {
  const [filterDept, setFilterDept] = useState<'ALL' | 'ICS' | 'IBE'>('ALL');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredStudents = initialStudents.filter((s) => {
    const isICS = ['BSIT', 'BSCS', 'ACT'].includes(s.course);
    if (filterDept === 'ICS' && !isICS) return false;
    if (filterDept === 'IBE' && isICS) return false;
    if (statusFilter !== 'ALL' && s.progress_status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesName = s.full_name.toLowerCase().includes(q);
      const matchesNum = s.student_number.toLowerCase().includes(q);
      const matchesCompany = (s.company_name || '').toLowerCase().includes(q);
      const matchesCourse = s.course.toLowerCase().includes(q);
      if (!matchesName && !matchesNum && !matchesCompany && !matchesCourse) return false;
    }
    return true;
  });

  function exportCSV() {
    const headers = ['Student Number', 'Student Name', 'Course', 'Host Company', 'Target Hours', 'Completed Hours', 'Remaining Hours', 'Status', 'Completion %'];
    const rows = filteredStudents.map(s => [
      `"${s.student_number}"`,
      `"${s.full_name}"`,
      `"${s.course}"`,
      `"${s.company_name || 'Unassigned'}"`,
      s.required_hours,
      s.completed_hours,
      s.remaining_hours,
      `"${s.progress_status}"`,
      `${s.percentage}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CDM_OJT_Department_Report_${filterDept}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departmental Monitoring & Summary Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Institutional OJT progress oversight and ISO/IEC 25010:2023 evaluation compliance for ICS & IBE.
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={exportCSV}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-teal-700 text-white hover:bg-teal-800 shadow-sm flex items-center gap-1.5 transition-colors"
          >
            🖨️ Print Summary
          </button>
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Trainees</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{summary.totalStudents}</h3>
              <p className="text-xs text-slate-400 mt-0.5">4th-Year ICS & IBE</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active in Field</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{summary.activeTrainees}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Deployed with host companies</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed OJT</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{summary.completedTrainees}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Requirements finalized</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Rendered</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{summary.totalRenderedHours}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Verified cumulative hours</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Quick Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ICS Card */}
        <Card className={`border-slate-200/90 shadow-sm transition-all ${filterDept === 'ICS' ? 'ring-2 ring-teal-600' : ''}`}>
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Institute of Computing Studies (ICS)</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">BS in Information Technology & Computer Science</p>
            </div>
            <button
              onClick={() => setFilterDept(filterDept === 'ICS' ? 'ALL' : 'ICS')}
              className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors"
            >
              {filterDept === 'ICS' ? 'Showing ICS ✓' : 'Filter ICS'}
            </button>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 font-medium">Trainees</span>
                <p className="text-lg font-bold text-slate-800 mt-1">{summary.departmentCounts.ICS.total}</p>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="text-xs text-emerald-700 font-medium">Completed</span>
                <p className="text-lg font-bold text-emerald-800 mt-1">{summary.departmentCounts.ICS.completed}</p>
              </div>
              <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100">
                <span className="text-xs text-teal-700 font-medium">Rendered</span>
                <p className="text-lg font-bold text-teal-800 mt-1">{Math.round(summary.departmentCounts.ICS.hours)} hrs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* IBE Card */}
        <Card className={`border-slate-200/90 shadow-sm transition-all ${filterDept === 'IBE' ? 'ring-2 ring-blue-600' : ''}`}>
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Institute of Business & Entrepreneurship (IBE)</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">BSBA, Accountancy & Hospitality Management</p>
            </div>
            <button
              onClick={() => setFilterDept(filterDept === 'IBE' ? 'ALL' : 'IBE')}
              className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              {filterDept === 'IBE' ? 'Showing IBE ✓' : 'Filter IBE'}
            </button>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 font-medium">Trainees</span>
                <p className="text-lg font-bold text-slate-800 mt-1">{summary.departmentCounts.IBE.total}</p>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="text-xs text-emerald-700 font-medium">Completed</span>
                <p className="text-lg font-bold text-emerald-800 mt-1">{summary.departmentCounts.IBE.completed}</p>
              </div>
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="text-xs text-blue-700 font-medium">Rendered</span>
                <p className="text-lg font-bold text-blue-800 mt-1">{Math.round(summary.departmentCounts.IBE.hours)} hrs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trainee Roster Table */}
      <Card className="border-slate-200/90 shadow-sm">
        <CardHeader className="p-5 pb-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">Trainee Progress Records</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Showing {filteredStudents.length} student records</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            {/* Search */}
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student, course, company..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            {/* Department Filter */}
            <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-semibold">
              <button
                onClick={() => setFilterDept('ALL')}
                className={`px-3 py-1 rounded-md transition-colors ${filterDept === 'ALL' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterDept('ICS')}
                className={`px-3 py-1 rounded-md transition-colors ${filterDept === 'ICS' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-500'}`}
              >
                ICS
              </button>
              <button
                onClick={() => setFilterDept('IBE')}
                className={`px-3 py-1 rounded-md transition-colors ${filterDept === 'IBE' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-500'}`}
              >
                IBE
              </button>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold rounded-xl border border-slate-200 px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="not_started">Not Started</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Course / Dept</th>
                  <th className="px-5 py-3">Host Company</th>
                  <th className="px-5 py-3">Rendered / Target</th>
                  <th className="px-5 py-3">Completion</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                      No trainee records matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => {
                    const isICS = ['BSIT', 'BSCS', 'ACT'].includes(s.course);
                    return (
                      <tr key={s.student_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-slate-900">{s.full_name}</p>
                          <p className="text-slate-400 text-[11px] font-mono mt-0.5">{s.student_number}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${isICS ? 'bg-teal-50 text-teal-700' : 'bg-blue-50 text-blue-700'}`}>
                            {s.course} ({isICS ? 'ICS' : 'IBE'})
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-700">
                          {s.company_name || 'Unassigned'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-slate-900">{s.completed_hours}</span>
                          <span className="text-slate-400"> / {s.required_hours} hrs</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${s.percentage >= 100 ? 'bg-emerald-500' : 'bg-teal-500'}`}
                                style={{ width: `${Math.min(100, s.percentage)}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-700">{s.percentage}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge
                            className={`text-[10px] uppercase tracking-wider font-bold ${
                              s.progress_status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : s.progress_status === 'in_progress'
                                ? 'bg-teal-50 text-teal-700 border-teal-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {s.progress_status.replace('_', ' ')}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
