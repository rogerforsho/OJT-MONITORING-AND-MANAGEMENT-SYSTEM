'use client';

import { useState } from 'react';
import Button from '@/src/components/ui/Button';
import Modal from '@/src/components/ui/Modal';
import { Badge } from '@/src/components/ui/Badge';
import { Award, Check, Clock, Shield, FileText } from '@/src/components/ui/Icons';
import { checkClearanceStatus, issueCertificate, type ClearanceCheckResult } from '@/src/services/certificates';

interface Props {
  studentId: string;
  studentName: string;
  completedHours: number;
}

export default function ClearanceActionModal({
  studentId,
  studentName,
  completedHours,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [clearance, setClearance] = useState<ClearanceCheckResult | null>(null);
  const [error, setError] = useState('');
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    setError('');
    setIssuedCode(null);
    const res = await checkClearanceStatus(studentId);
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error?.message || 'Failed to check clearance profile.');
      return;
    }
    setClearance(res.data);
    if (res.data.certificate) {
      setIssuedCode(res.data.certificate.verification_code);
    }
  }

  async function handleIssue() {
    setIssuing(true);
    setError('');
    const res = await issueCertificate(studentId);
    setIssuing(false);
    if (res.error || !res.data) {
      setError(res.error?.message || 'Failed to issue certificate.');
      return;
    }
    setIssuedCode(res.data.verification_code);
    const updated = await checkClearanceStatus(studentId);
    if (updated.data) setClearance(updated.data);
  }

  const isEligible = clearance?.can_issue;

  return (
    <>
      <button
        onClick={handleOpen}
        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
          completedHours >= 486
            ? 'bg-[#0A3D24] text-[#FFCC00] hover:bg-[#062415] shadow-xs'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
        }`}
      >
        {completedHours >= 486 ? '🎓 Clearance' : 'Inspect'}
      </button>

      <Modal
        title={`Graduation Clearance: ${studentName}`}
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            {isEligible && !issuedCode && (
              <Button
                onClick={handleIssue}
                loading={issuing}
                className="bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold shadow-md"
              >
                Sign Off & Issue Certificate
              </Button>
            )}
          </div>
        }
      >
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">
            Verifying 3-pillar clearance records...
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
            {error}
          </div>
        ) : clearance ? (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <p className="text-slate-500 font-medium">
                Student ID: <span className="font-mono text-slate-900 font-bold">{clearance.student_number}</span> • Program: <strong className="text-slate-900">{clearance.course}</strong>
              </p>
              <p className="text-slate-500 font-medium">
                Rendered Hours: <span className="font-bold text-[#0A3D24]">{clearance.completed_hours.toFixed(1)}</span> / {clearance.required_hours} Hours
              </p>
            </div>

            {/* 3 Clearance Pillars Checklist */}
            <div className="space-y-2.5">
              <h4 className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#0A3D24]" /> Institutional Clearance Gateways
              </h4>

              {/* Pillar 1 */}
              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                clearance.hours_met ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    clearance.hours_met ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'
                  }`}>
                    {clearance.hours_met ? <Check className="w-3 h-3 stroke-[3]" /> : <Clock className="w-3 h-3" />}
                  </div>
                  <div>
                    <span className="font-bold">1. Verified Rendered Hours ({clearance.completed_hours} / {clearance.required_hours}h)</span>
                    <p className="text-[10px] text-slate-500">Biometric selfie & GPS attendance log</p>
                  </div>
                </div>
                <Badge className={clearance.hours_met ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}>
                  {clearance.hours_met ? 'COMPLETED' : 'INCOMPLETE'}
                </Badge>
              </div>

              {/* Pillar 2 */}
              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                clearance.final_report_approved ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    clearance.final_report_approved ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'
                  }`}>
                    {clearance.final_report_approved ? <Check className="w-3 h-3 stroke-[3]" /> : <FileText className="w-3 h-3" />}
                  </div>
                  <div>
                    <span className="font-bold">2. Final Practicum Narrative & Portfolio</span>
                    <p className="text-[10px] text-slate-500">Approved by OJT Practicum Faculty</p>
                  </div>
                </div>
                <Badge className={clearance.final_report_approved ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}>
                  {clearance.final_report_approved ? 'APPROVED' : 'PENDING'}
                </Badge>
              </div>

              {/* Pillar 3 */}
              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                clearance.evaluation_passed ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    clearance.evaluation_passed ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'
                  }`}>
                    {clearance.evaluation_passed ? <Check className="w-3 h-3 stroke-[3]" /> : <Award className="w-3 h-3" />}
                  </div>
                  <div>
                    <span className="font-bold">3. Industry Supervisor Appraisals (Passing &ge; 75.0%)</span>
                    <p className="text-[10px] text-slate-500">
                      Midterm: {clearance.midterm_score !== null ? `${clearance.midterm_score}%` : 'Not Rated'} • Final: {clearance.final_score !== null ? `${clearance.final_score}%` : 'Not Rated'}
                    </p>
                  </div>
                </div>
                <Badge className={clearance.evaluation_passed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}>
                  {clearance.evaluation_passed ? `${clearance.evaluation_score}% PASSED` : 'AWAITING'}
                </Badge>
              </div>
            </div>

            {/* Issued Certificate Details */}
            {issuedCode && (
              <div className="p-3.5 bg-[#FAF8F5] border-2 border-[#0A3D24] rounded-xl text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#0A3D24]">
                  <Award className="w-4 h-4" /> Official Certificate of Completion Issued
                </div>
                <p className="font-mono text-sm font-extrabold text-slate-900 tracking-wider">
                  Serial: {issuedCode}
                </p>
                <a
                  href={`/verify-certificate/${issuedCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#0A3D24] font-bold underline block"
                >
                  Open Tamper-Proof Public Verification Portal →
                </a>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
