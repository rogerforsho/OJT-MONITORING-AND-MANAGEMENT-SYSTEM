'use client';

import { useEffect, useState, useCallback } from 'react';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import Badge from '@/src/components/ui/Badge';
import Modal from '@/src/components/ui/Modal';
import {
  listAttendanceForSupervisor,
  verifyAttendance,
  getSelfieUrl,
  type AttendanceWithStudent,
} from '@/src/services/attendance';
import type { VerificationStatus } from '@ojt/shared';

const PAGE_SIZE = 20;
const FILTERS: { label: string; value: VerificationStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: 'pending' },
  { label: 'Verified', value: 'verified' },
  { label: 'Rejected', value: 'rejected' },
];

export default function SupervisorAttendancePage() {
  const [records, setRecords] = useState<AttendanceWithStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<VerificationStatus | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<AttendanceWithStudent | null>(null);
  const [selfieUrl, setSelfieUrl] = useState('');
  const [selfieLoading, setSelfieLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const load = useCallback(async (p: number, f: VerificationStatus | undefined) => {
    setLoading(true);
    setError('');
    const result = await listAttendanceForSupervisor(p, PAGE_SIZE, f);
    setLoading(false);
    if (result.error) { setError(result.error.message); return; }
    setRecords(result.data!.records);
    setTotal(result.data!.total);
  }, []);

  useEffect(() => { load(page, filter); }, [page, filter, load]);

  async function openRecord(record: AttendanceWithStudent) {
    setSelected(record);
    setSelfieUrl('');
    setVerifyError('');
    if (record.time_in_selfie_path) {
      setSelfieLoading(true);
      const result = await getSelfieUrl(record.time_in_selfie_path);
      setSelfieLoading(false);
      if (!result.error) setSelfieUrl(result.data!.url);
    }
  }

  async function handleVerify(status: 'verified' | 'rejected') {
    if (!selected) return;
    setVerifyError('');
    setVerifying(true);
    const result = await verifyAttendance(selected.attendance_id, status);
    setVerifying(false);
    if (result.error) { setVerifyError(result.error.message); return; }
    setSelected(null);
    load(page, filter);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance Verification</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} record{total !== 1 ? 's' : ''}</p>
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => { setFilter(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all
                ${filter === f.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading...</div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">📋</span>
            <p className="text-sm">No attendance records found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Student</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Date</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Time In</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Time Out</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Late</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {records.map(r => (
                <tr key={r.attendance_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{r.students?.users?.full_name}</p>
                    <p className="text-xs text-slate-400">{r.students?.student_number}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">{r.attendance_date}</td>
                  <td className="px-5 py-4 text-slate-700">
                    {r.time_in ? new Date(r.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {r.time_out ? new Date(r.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <Badge status={r.late_status} />
                  </td>
                  <td className="px-5 py-4">
                    <Badge status={r.verification_status} />
                  </td>
                  <td className="px-5 py-4">
                    <Button variant="ghost" onClick={() => openRecord(r)}>Review</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</Button>
            <Button variant="ghost" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}

      {/* Review Modal */}
      <Modal title="Review Attendance" open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Student</p>
                <p className="font-medium text-slate-900">{selected.students?.users?.full_name}</p>
                <p className="text-slate-500">{selected.students?.student_number}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Date</p>
                <p className="font-medium text-slate-900">{selected.attendance_date}</p>
                <Badge status={selected.late_status} />
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Time In</p>
                <p className="font-medium text-slate-900">
                  {selected.time_in ? new Date(selected.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Time Out</p>
                <p className="font-medium text-slate-900">
                  {selected.time_out ? new Date(selected.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </p>
              </div>
            </div>

            {/* Selfie */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Time In Selfie Evidence</p>
              {selfieLoading ? (
                <div className="h-48 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm">
                  Loading selfie...
                </div>
              ) : selfieUrl ? (
                <img src={selfieUrl} alt="Time In Selfie" className="w-full h-48 object-cover rounded-xl border border-slate-200" />
              ) : (
                <div className="h-48 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm">
                  No selfie available
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="text-xs text-slate-400 mb-1">QR Validation</p>
              <Badge status={selected.qr_validation_status} />
            </div>

            {verifyError && <Alert type="error" message={verifyError} />}

            {selected.verification_status === 'pending' ? (
              <div className="flex gap-3">
                <Button onClick={() => handleVerify('verified')} loading={verifying} className="flex-1">
                  ✓ Verify
                </Button>
                <Button
                  onClick={() => handleVerify('rejected')}
                  loading={verifying}
                  variant="ghost"
                  className="flex-1 text-red-500 hover:bg-red-50"
                >
                  ✗ Reject
                </Button>
              </div>
            ) : (
              <div className="text-center text-sm text-slate-500">
                This record has been <Badge status={selected.verification_status} />
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
