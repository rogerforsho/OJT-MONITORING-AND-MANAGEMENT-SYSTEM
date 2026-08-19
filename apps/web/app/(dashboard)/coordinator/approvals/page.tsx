'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@/src/components/ui/Alert';
import Button from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { listPendingStudents, updateStudentAccountStatus } from '@/src/services/auth';

type PendingStudent = {
  user_id: string;
  full_name: string;
  email: string;
  student_number: string;
  course: string;
  year_level: number;
  created_at: string;
};

const PAGE_SIZE = 20;

export default function CoordinatorApprovalsPage() {
  const [students, setStudents] = useState<PendingStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [courseFilter, setCourseFilter] = useState('All');

  const load = useCallback(async (pageNumber: number) => {
    setLoading(true);
    setError('');

    const result = await listPendingStudents(pageNumber, PAGE_SIZE);
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setStudents(result.data?.students ?? []);
    setTotal(result.data?.total ?? 0);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      if (!active) return;
      await load(page);
    };
    fetchData();
    return () => { active = false; };
  }, [page, load]);

  async function handleAction(user_id: string, status: 'active' | 'rejected') {
    setError('');
    setSuccess('');
    setActionLoading(user_id);
    const result = await updateStudentAccountStatus(user_id, status);
    setActionLoading('');

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSuccess(`Student registration ${status === 'active' ? 'approved' : 'rejected'} successfully.`);
    load(page);
  }

  async function handleBatchApprove() {
    const targetIds = selectedIds.length > 0 ? selectedIds : students.map(s => s.user_id);
    if (targetIds.length === 0) return;

    if (!confirm(`Are you sure you want to approve ${targetIds.length} pending student(s)?`)) return;

    setBatchLoading(true);
    setError('');
    setSuccess('');

    let approvedCount = 0;
    for (const id of targetIds) {
      const res = await updateStudentAccountStatus(id, 'active');
      if (!res.error) approvedCount++;
    }

    setBatchLoading(false);
    setSelectedIds([]);
    setSuccess(`Successfully approved ${approvedCount} student(s).`);
    load(page);
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map(s => s.user_id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const courses = ['All', 'BSIT', 'BSCS', 'BSBA-MKT', 'BSBA-HRM', 'BSBA-FM', 'BSA'];
  const filteredStudents = courseFilter === 'All'
    ? students
    : students.filter(s => s.course === courseFilter);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Student Registration Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">Review, verify, and activate pending 4th-year ICS & IBE practicum trainee accounts.</p>
        </div>
        {students.length > 0 && (
          <div className="flex items-center gap-3">
            <Button
              onClick={handleBatchApprove}
              loading={batchLoading}
              className="bg-[#0A3D24] hover:bg-[#062415] text-white shadow-sm font-medium text-xs sm:text-sm px-4 py-2"
            >
              ✓ Approve {selectedIds.length > 0 ? `Selected (${selectedIds.length})` : `All Pending (${students.length})`}
            </Button>
          </div>
        )}
      </div>

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      {/* Course Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {courses.map((c) => (
          <button
            key={c}
            onClick={() => setCourseFilter(c)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              courseFilter === c
                ? 'bg-[#062415] text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading pending students...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">🎓</span>
            <p className="text-sm font-medium text-slate-600">No pending student registrations at the moment.</p>
            <p className="text-xs text-slate-400 mt-1">All 4th-year student applications have been processed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredStudents.length && filteredStudents.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-[#0A3D24] focus:ring-[#0A3D24]"
                    />
                  </th>
                  <th className="px-5 py-3.5 font-medium text-slate-600">Student</th>
                  <th className="px-5 py-3.5 font-medium text-slate-600">Institutional Email</th>
                  <th className="px-5 py-3.5 font-medium text-slate-600">Degree Program</th>
                  <th className="px-5 py-3.5 font-medium text-slate-600">Year Level</th>
                  <th className="px-5 py-3.5 font-medium text-slate-600">Requested Date</th>
                  <th className="px-5 py-3.5 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map(student => {
                  const isSelected = selectedIds.includes(student.user_id);
                  return (
                    <tr key={student.user_id} className={`hover:bg-slate-50/60 transition-colors ${isSelected ? 'bg-emerald-50/30' : ''}`}>
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(student.user_id)}
                          className="rounded border-slate-300 text-[#0A3D24] focus:ring-[#0A3D24]"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{student.full_name}</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{student.student_number}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-mono text-xs">{student.email}</td>
                      <td className="px-5 py-4">
                        <Badge variant="outline" className="text-xs font-semibold bg-slate-50">
                          {student.course}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-700 font-medium">4th Year</td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{new Date(student.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            onClick={() => handleAction(student.user_id, 'rejected')}
                            loading={actionLoading === student.user_id}
                            className="text-red-600 hover:bg-red-50 text-xs px-3 py-1.5"
                          >
                            Reject
                          </Button>
                          <Button
                            onClick={() => handleAction(student.user_id, 'active')}
                            loading={actionLoading === student.user_id}
                            className="bg-[#0A3D24] hover:bg-[#062415] text-white text-xs px-3 py-1.5"
                          >
                            Approve
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>Page {page} of {totalPages} ({total} total)</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
