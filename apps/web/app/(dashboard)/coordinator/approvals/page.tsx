'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@/src/components/ui/Alert';
import Button from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import Modal from '@/src/components/ui/Modal';
import { listPendingStudents, updateStudentAccountStatus } from '@/src/services/auth';

type PendingStudent = {
  user_id: string;
  full_name: string;
  email: string;
  student_number: string;
  course: string;
  year_level: number;
  created_at: string;
  id_card_path?: string | null;
  id_card_signed_url?: string | null;
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
  const [viewingId, setViewingId] = useState<{ url: string; name: string; number: string; course: string } | null>(null);

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<PendingStudent | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

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

    if (status === 'rejected') {
      const target = students.find(s => s.user_id === user_id);
      if (target) {
        setRejectTarget(target);
        setRejectionReason('');
        setRejectModalOpen(true);
      }
      return;
    }

    setActionLoading(user_id);
    const result = await updateStudentAccountStatus(user_id, status);
    setActionLoading('');

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSuccess('Student registration approved successfully and notification email dispatched.');
    load(page);
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setRejectSubmitting(true);
    setError('');
    setSuccess('');

    const result = await updateStudentAccountStatus(
      rejectTarget.user_id,
      'rejected',
      rejectionReason.trim() || undefined
    );
    setRejectSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setRejectModalOpen(false);
    setSuccess(`Registration for ${rejectTarget.full_name} rejected and explanation email dispatched.`);
    load(page);
  }

  async function handleBatchApprove() {
    const targetIds = selectedIds.length > 0 ? selectedIds : students.map(s => s.user_id);
    if (targetIds.length === 0) return;

    if (!confirm(`Are you sure you want to approve ${targetIds.length} pending student(s)?`)) return;

    setBatchLoading(true);
    setError('');
    setSuccess('');

    // Concurrent chunking for 5x performance improvement
    const chunkSize = 5;
    let approvedCount = 0;
    for (let i = 0; i < targetIds.length; i += chunkSize) {
      const chunk = targetIds.slice(i, i + chunkSize);
      const results = await Promise.all(chunk.map(id => updateStudentAccountStatus(id, 'active')));
      approvedCount += results.filter(r => !r.error).length;
    }

    setBatchLoading(false);
    setSelectedIds([]);
    setSuccess(`Successfully approved ${approvedCount} student(s) in batch.`);
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
                  <th className="px-5 py-3.5 font-medium text-slate-600">Validated ID</th>
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
                      <td className="px-5 py-4">
                        {student.id_card_signed_url ? (
                          <button
                            type="button"
                            onClick={() => setViewingId({
                              url: student.id_card_signed_url!,
                              name: student.full_name,
                              number: student.student_number,
                              course: student.course,
                            })}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                          >
                            <span>🪪</span> Inspect ID
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not attached</span>
                        )}
                      </td>
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

      {viewingId && (
        <Modal
          title={`Validated Student ID — ${viewingId.name}`}
          open={!!viewingId}
          onClose={() => setViewingId(null)}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600 pb-2 border-b border-slate-100">
              <span className="font-mono font-semibold">Student No: {viewingId.number}</span>
              <span className="font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">{viewingId.course} • 4th Year</span>
            </div>

            <div className="w-full max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center p-2">
              {viewingId.url.toLowerCase().includes('.pdf') ? (
                <iframe src={viewingId.url} className="w-full h-[450px] rounded-lg" title="Student ID Document" />
              ) : (
                <img
                  src={viewingId.url}
                  alt={`${viewingId.name} ID Card`}
                  className="max-h-[450px] w-auto object-contain rounded-lg shadow-xs"
                />
              )}
            </div>

            <div className="flex justify-between items-center pt-2 text-xs text-slate-500">
              <a
                href={viewingId.url}
                target="_blank"
                rel="noreferrer"
                className="text-[#0A3D24] font-semibold hover:underline flex items-center gap-1"
              >
                <span>↗</span> Open in new tab
              </a>
              <Button variant="ghost" onClick={() => setViewingId(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Registration Modal */}
      {rejectModalOpen && rejectTarget && (
        <Modal
          title="Reject Student Registration"
          open={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
        >
          <div className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
              <p className="font-bold text-rose-900 text-sm">{rejectTarget.full_name}</p>
              <p className="text-rose-700">
                {rejectTarget.student_number} • {rejectTarget.course} • 4th Year
              </p>
              <p className="text-rose-600 text-[11px] pt-1">
                Rejecting this registration will notify the student at <strong className="font-semibold">{rejectTarget.email}</strong>.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Reason for Rejection / Correction Instructions
              </label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="e.g., Unclear student ID photo, student number mismatch, or unverified enrollment. Please re-register with a clear copy of your CdM ID."
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-[#0A3D24]"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setRejectModalOpen(false)}
                disabled={rejectSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                loading={rejectSubmitting}
                onClick={confirmReject}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}

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
