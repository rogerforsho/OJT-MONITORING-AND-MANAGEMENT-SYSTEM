'use client';

import { useEffect, useState, useCallback } from 'react';
import { listAttendanceForSupervisor, verifyAttendance, getSelfieUrl, batchVerifyAttendance, type AttendanceWithStudent } from '@/src/services/attendance';
import Button from '@/src/components/ui/Button';
import Badge from '@/src/components/ui/Badge';
import Modal from '@/src/components/ui/Modal';
import Alert from '@/src/components/ui/Alert';
import type { VerificationStatus } from '@ojt/shared';

const PAGE_SIZE = 20;

const FILTERS: { label: string; value: VerificationStatus | undefined }[] = [
  { label: 'All Records', value: undefined },
  { label: 'Pending Review', value: 'pending' },
  { label: 'Verified', value: 'verified' },
  { label: 'Rejected', value: 'rejected' },
];

export default function SupervisorAttendancePage() {
  const [records, setRecords] = useState<AttendanceWithStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<VerificationStatus | undefined>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);

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

  useEffect(() => {
    load(page, filter);
  }, [page, filter, load]);

  async function openRecord(record: AttendanceWithStudent) {
    setSelected(record);
    setVerifyError('');
    setSelfieUrl('');
    if (record.time_in_selfie_path) {
      setSelfieLoading(true);
      const urlRes = await getSelfieUrl(record.time_in_selfie_path);
      setSelfieLoading(false);
      setSelfieUrl(urlRes.data?.url || '');
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

  async function handleBatchVerify() {
    setBatchLoading(true);
    setError('');
    setSuccess('');
    const result = await batchVerifyAttendance();
    setBatchLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSuccess(`Successfully verified ${result.data?.verifiedCount || 0} pending attendance records.`);
    load(page, filter);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8 max-w-7xl mx-auto page-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0A3D24] font-serif tracking-tight">Attendance Verification</h1>
          <p className="text-sm text-slate-500 mt-1">Review trainee daily logs, selfie evidence, punctuality, and sync statuses.</p>
        </div>
        {filter === 'pending' && records.length > 0 && (
          <Button
            onClick={handleBatchVerify}
            loading={batchLoading}
            className="bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold text-xs shadow-sm py-2 px-4 whitespace-nowrap"
          >
            ✓ Batch Verify Pending
          </Button>
        )}
      </div>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
      {success && <div className="mb-4"><Alert type="success" message={success} /></div>}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-3">
        {FILTERS.map(f => (
          <button
            key={f.label}
            onClick={() => { setFilter(f.value); setPage(1); }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              filter === f.value
                ? 'bg-[#0A3D24] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading attendance records...</div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">📋</span>
            <p className="text-sm font-medium text-slate-600">No attendance records found for this filter.</p>
            <p className="text-xs text-slate-400 mt-1">All trainee attendance submissions are up to date.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 font-medium text-slate-600">Trainee</th>
                  <th className="px-5 py-3.5 font-medium text-slate-600">Date</th>
                  <th className="px-5 py-3.5 font-medium text-slate-600">Time In</th>
                  <th className="px-5 py-3.5 font-medium text-slate-600">Time Out</th>
                  <th className="px-5 py-3.5 font-medium text-slate-600">Schedule</th>
                  <th className="px-5 py-3.5 font-medium text-slate-600">Status</th>
                  <th className="px-5 py-3.5 text-right font-medium text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map(r => {
                  const isOfflineSynced = r.sync_status === 'pending_sync' || Boolean(r.time_in_selfie_path?.includes('offline'));
                  return (
                    <tr key={r.attendance_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">{r.students?.users?.full_name}</p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{r.students?.student_number}</p>
                          </div>
                          {isOfflineSynced && (
                            <span className="inline-flex items-center text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title="Captured offline and synced">
                              📁 Offline
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-700 font-medium">{r.attendance_date}</td>
                      <td className="px-5 py-4 text-slate-700 font-mono text-xs">
                        {r.time_in ? new Date(r.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-5 py-4 text-slate-700 font-mono text-xs">
                        {r.time_out ? new Date(r.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-5 py-4">
                        <Badge status={r.late_status} />
                      </td>
                      <td className="px-5 py-4">
                        <Badge status={r.verification_status} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="ghost"
                          onClick={() => openRecord(r)}
                          className="bg-slate-50 hover:bg-slate-100 text-[#0A3D24] text-xs font-semibold px-3 py-1.5 border border-slate-200"
                        >
                          Inspect & Verify
                        </Button>
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

      {/* Review Modal */}
      <Modal title="Inspect Attendance & Selfie Evidence" open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            {Boolean(selected.sync_status === 'pending_sync' || selected.time_in_selfie_path?.includes('offline')) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                <span className="text-base">📁</span>
                <div>
                  <p className="text-xs font-bold text-amber-900">Recorded Offline & Synchronized</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    This attendance record was captured on the trainee&apos;s device offline and automatically synchronized once internet was restored. Please verify physical presence.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs text-slate-400 mb-0.5">Trainee</p>
                <p className="font-semibold text-slate-900">{selected.students?.users?.full_name}</p>
                <p className="text-xs text-slate-500 font-mono">{selected.students?.student_number}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs text-slate-400 mb-0.5">Date & Punctuality</p>
                <p className="font-semibold text-slate-900">{selected.attendance_date}</p>
                <div className="mt-1"><Badge status={selected.late_status} /></div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs text-slate-400 mb-0.5">Time In</p>
                <p className="font-mono text-xs font-semibold text-slate-900">
                  {selected.time_in ? new Date(selected.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs text-slate-400 mb-0.5">Time Out</p>
                <p className="font-mono text-xs font-semibold text-slate-900">
                  {selected.time_out ? new Date(selected.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                </p>
              </div>
            </div>

            {/* Selfie Preview */}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Time In Selfie Evidence</p>
              {selfieLoading ? (
                <div className="h-52 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm">
                  Loading selfie evidence...
                </div>
              ) : selfieUrl ? (
                <img
                  src={selfieUrl}
                  alt="Time In Selfie"
                  className="w-full h-52 object-cover rounded-xl border border-slate-200 shadow-sm"
                />
              ) : (
                <div className="h-52 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm">
                  No selfie available for this record
                </div>
              )}
            </div>

            {verifyError && <Alert type="error" message={verifyError} />}

            {selected.verification_status === 'pending' ? (
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => handleVerify('verified')}
                  loading={verifying}
                  className="flex-1 bg-[#0A3D24] hover:bg-[#062415] text-white py-2 font-medium"
                >
                  ✓ Verify Attendance
                </Button>
                <Button
                  onClick={() => handleVerify('rejected')}
                  loading={verifying}
                  variant="ghost"
                  className="flex-1 text-red-600 hover:bg-red-50 border border-red-200 py-2 font-medium"
                >
                  ✕ Reject Record
                </Button>
              </div>
            ) : (
              <div className="text-center py-2 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600">
                This record has already been marked as <Badge status={selected.verification_status} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
