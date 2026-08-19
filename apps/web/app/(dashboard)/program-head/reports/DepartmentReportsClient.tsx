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
    const isICS = ['BSIT', 'BSCS'].includes(s.course);
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
      `"${s.percentage}%"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CdM_OJT_${filterDept}_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="p-4 sm:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Academic Department Analytics & Reports</h1>
          <p className="text-sm text-slate-500 mt-1">High-level institutional monitoring for the Institute of Computing Studies & Institute of Business and Entrepreneurship.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
          >
            🖨️ Print Report
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#0A3D24] text-white hover:bg-[#062415] shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#FFCC00]" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Enrolled Interns</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalStudents}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">4th Year ICS & IBE</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#0A3D24] flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active in Field</p>
              <p className="text-2xl font-bold text-[#0A3D24] mt-1">{summary.activeTrainees}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Assigned to Partner Companies</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Building className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completed Practicum</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{summary.completedTrainees}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Reached 486.0 Target Hours</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Rendered Hours</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalRenderedHours.toFixed(1)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Verified Industry Hours</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Institute Comparison Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
        <Card className="border-slate-200/80 shadow-sm bg-white rounded-2xl">
          <CardHeader className="p-5 pb-3">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Institute of Computing Studies (ICS)</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">BSIT & BSCS Practicum Trainees</p>
              </div>
              <Badge className="bg-emerald-50 text-[#0A3D24] border-emerald-200 text-xs">
                {summary.departmentCounts?.ICS?.total ?? 0} Students
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3">
            <div className="flex justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
              <span>Completed Target:</span>
              <span className="font-semibold text-slate-900">{summary.departmentCounts?.ICS?.completed ?? 0}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Aggregate Hours:</span>
              <span className="font-semibold text-slate-900">{summary.departmentCounts?.ICS?.hours?.toFixed(1) ?? 0} hrs</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm bg-white rounded-2xl">
          <CardHeader className="p-5 pb-3">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Institute of Business and Entrepreneurship (IBE)</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">BSBA & BSA Practicum Trainees</p>
              </div>
              <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-xs">
                {summary.departmentCounts?.IBE?.total ?? 0} Students
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3">
            <div className="flex justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
              <span>Completed Target:</span>
              <span className="font-semibold text-slate-900">{summary.departmentCounts?.IBE?.completed ?? 0}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Aggregate Hours:</span>
              <span className="font-semibold text-slate-900">{summary.departmentCounts?.IBE?.hours?.toFixed(1) ?? 0} hrs</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trainee Roster and Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          {/* Department Filter Tabs */}
          <div className="flex items-center gap-1.5">
            {(['ALL', 'ICS', 'IBE'] as const).map((dept) => (
              <button
                key={dept}
                onClick={() => setFilterDept(dept)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filterDept === dept
                    ? 'bg-[#062415] text-[#FFCC00] shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {dept === 'ALL' ? 'All Institutes' : dept}
              </button>
            ))}
          </div>

          {/* Search and Status Filters */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search trainee or company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0A3D24] w-48 sm:w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0A3D24]"
            >
              <option value="ALL">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="not_started">Not Started</option>
            </select>
          </div>
        </div>

        {/* Detailed Table */}
        <Card className="border-slate-200/80 shadow-sm overflow-hidden bg-white rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Student</th>
                  <th className="py-3.5 px-4">Program</th>
                  <th className="py-3.5 px-4">Host Company</th>
                  <th className="py-3.5 px-4">Rendered / Target</th>
                  <th className="py-3.5 px-4 w-48">Progress</th>
                  <th className="py-3.5 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-medium text-slate-600">No student records match the selected criteria.</p>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => {
                    const isDone = s.progress_status === 'completed';
                    return (
                      <tr key={s.student_id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-semibold text-slate-900">{s.full_name}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{s.student_number}</div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="outline" className="text-xs font-semibold bg-slate-50">
                            {s.course}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-xs font-medium text-slate-700 max-w-[200px] truncate">
                            {s.company_name || 'Unassigned'}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-xs font-bold text-slate-900">
                            {s.completed_hours} <span className="text-slate-400 font-normal">/ {s.required_hours} hrs</span>
                          </div>
                          <div className="text-[11px] text-slate-400">{s.remaining_hours} hrs remaining</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                              <span>{s.percentage}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isDone ? 'bg-emerald-500' : 'bg-[#0A3D24]'
                                }`}
                                style={{ width: `${Math.min(100, s.percentage)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <Badge
                            className={
                              isDone
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold'
                                : s.completed_hours > 0
                                ? 'bg-emerald-50 text-[#0A3D24] border-emerald-200 text-xs font-semibold'
                                : 'bg-slate-100 text-slate-600 border-slate-200 text-xs font-semibold'
                            }
                          >
                            {isDone ? 'Completed' : s.completed_hours > 0 ? 'In Progress' : 'Not Started'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
