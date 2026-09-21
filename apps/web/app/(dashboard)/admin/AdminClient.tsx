'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import Modal from '@/src/components/ui/Modal';
import {
  Users,
  Shield,
  Building,
  Clock,
  Megaphone,
  Bell,
  Check,
  X,
  AlertCircle,
  Search,
  Filter,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  AlertTriangle,
  Key,
  Copy,
  CheckCheck,
  BarChart3,
  Database,
  Download,
  FileSpreadsheet,
} from '@/src/components/ui/Icons';
import {
  updateUserAccountStatus,
  createSystemUser,
  deleteSystemUser,
  adminResetUserPassword,
  listAllUsers,
  generateDatabaseSnapshot,
  getPracticumRosterReport,
  type UserManagementItem,
  type CreateSystemUserInput,
  type DatabaseSnapshotResult,
  type PracticumReportSummary,
  type PracticumRosterItem,
} from '@/src/services/admin';
import { createAnnouncement, listAnnouncements, deleteAnnouncement } from '@/src/services/announcements';
import type { DbAnnouncement } from '@ojt/shared';
import { listAuditLogs, type AuditLogItem } from '@/src/services/audit';
import type { AccountStatus } from '@ojt/shared';

interface Props {
  initialUsers: UserManagementItem[];
  totalUsers: number;
  overview: {
    totalUsers: number;
    activeUsers: number;
    pendingUsers: number;
    companiesCount: number;
    attendanceCount: number;
    roleBreakdown: Record<string, number>;
  };
}

const PAGE_SIZE = 10;

const ROLE_TABS = [
  { id: 'all', label: 'All Roles' },
  { id: 'Student', label: 'Students' },
  { id: 'Supervisor', label: 'Supervisors' },
  { id: 'Coordinator', label: 'Coordinators' },
  { id: 'ProgramHead', label: 'Program Heads' },
  { id: 'Admin', label: 'Admins' },
] as const;

export default function AdminClient({ initialUsers, totalUsers: initialTotal, overview }: Props) {
  const [users, setUsers] = useState<UserManagementItem[]>(initialUsers);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const hasLoadedInitialRef = useRef(false);

  // Delete User Modal State
  const [deleteTarget, setDeleteTarget] = useState<UserManagementItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Admin Direct Password Reset State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<UserManagementItem | null>(null);
  const [customResetPassword, setCustomResetPassword] = useState('');
  const [generatedPasswordResult, setGeneratedPasswordResult] = useState<string | null>(null);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Create Staff Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [staffForm, setStaffForm] = useState<CreateSystemUserInput>({
    full_name: '',
    email: '',
    password: '',
    role: 'Coordinator',
    department_or_program: 'ICS',
    employee_number: `${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Announcement State
  const [anncTitle, setAnncTitle] = useState('');
  const [anncContent, setAnncContent] = useState('');
  const [anncDept, setAnncDept] = useState('All');
  const [anncDeliveryType, setAnncDeliveryType] = useState<'announcement' | 'alert'>('announcement');
  const [anncLoading, setAnncLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<DbAnnouncement[]>([]);
  const [anncListLoading, setAnncListLoading] = useState(true);
  const [deleteAnncModalOpen, setDeleteAnncModalOpen] = useState(false);
  const [anncToDelete, setAnncToDelete] = useState<DbAnnouncement | null>(null);
  const [deleteAnncLoading, setDeleteAnncLoading] = useState(false);
  const [isBroadcastFormOpen, setIsBroadcastFormOpen] = useState(false);
  const [isActiveBroadcastsOpen, setIsActiveBroadcastsOpen] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  // Top Level Segmented Main Tab: 'users' | 'reports' | 'backups'
  const [mainTab, setMainTab] = useState<'users' | 'reports' | 'backups'>('users');

  // Practicum Reports State
  const [practicumSummary, setPracticumSummary] = useState<PracticumReportSummary | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportProgramFilter, setReportProgramFilter] = useState<string>('all');
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');

  // Database Backup State
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupResult, setBackupResult] = useState<DatabaseSnapshotResult | null>(null);
  const [backupConfirmOpen, setBackupConfirmOpen] = useState(false);
  const [backupCopied, setBackupCopied] = useState(false);

  const fetchUsers = useCallback(async (
    targetPage: number,
    targetRole: string,
    targetStatus: string,
    targetSearch: string
  ) => {
    setTableLoading(true);
    setTableError(null);
    try {
      const res = await listAllUsers(targetPage, PAGE_SIZE, targetRole, targetStatus, targetSearch);
      if (res.data) {
        setUsers(res.data.users);
        setTotalCount(res.data.total);
      } else if (res.error) {
        setTableError(res.error.message || 'Failed to retrieve user records.');
      }
    } catch (err: any) {
      setTableError(err?.message || 'Network error while loading user records.');
    } finally {
      setTableLoading(false);
    }
  }, []);

  // Fetch users when filters change, keeping initialUsers on first render if already present
  useEffect(() => {
    if (!hasLoadedInitialRef.current) {
      hasLoadedInitialRef.current = true;
      if (initialUsers && initialUsers.length > 0 && roleFilter === 'all' && statusFilter === 'all' && !searchQuery && page === 1) {
        setUsers(initialUsers);
        setTotalCount(initialTotal);
        return;
      }
    }
    fetchUsers(page, roleFilter, statusFilter, searchQuery);
  }, [page, roleFilter, statusFilter, searchQuery, fetchUsers, initialUsers, initialTotal]);

  const loadAnnouncements = useCallback(async () => {
    setAnncListLoading(true);
    const res = await listAnnouncements();
    if (res.data) {
      setAnnouncements(res.data);
    }
    setAnncListLoading(false);
  }, []);

  useEffect(() => {
    loadAudit();
    loadAnnouncements();
  }, [loadAnnouncements]);

  async function loadAudit() {
    setAuditLoading(true);
    const res = await listAuditLogs(1, 10);
    if (res.data?.logs) {
      setAuditLogs(res.data.logs);
    }
    setAuditLoading(false);
  }

  const handleDeleteAnnouncementClick = (annc: DbAnnouncement) => {
    setAnncToDelete(annc);
    setDeleteAnncModalOpen(true);
  };

  const confirmDeleteAnnouncement = async () => {
    if (!anncToDelete) return;
    setDeleteAnncLoading(true);
    const res = await deleteAnnouncement(anncToDelete.announcement_id);
    setDeleteAnncLoading(false);
    setDeleteAnncModalOpen(false);

    if (res.error) {
      setMsg({ type: 'error', text: res.error.message });
    } else {
      setMsg({ type: 'success', text: `Announcement "${anncToDelete.title}" has been permanently removed.` });
      setAnncToDelete(null);
      loadAnnouncements();
      loadAudit();
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleRoleChange = (role: string) => {
    setRoleFilter(role);
    setPage(1);
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  const loadPracticumReports = useCallback(async (filter?: string) => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const res = await getPracticumRosterReport(filter);
      if (res.data) {
        setPracticumSummary(res.data);
      } else if (res.error) {
        setReportsError(res.error.message || 'Failed to load practicum analytics.');
      }
    } catch (err: any) {
      setReportsError(err?.message || 'Error connecting to report service.');
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === 'reports') {
      loadPracticumReports(reportProgramFilter);
    }
  }, [mainTab, reportProgramFilter, loadPracticumReports]);

  const handleExportRosterCSV = () => {
    if (!practicumSummary?.roster || practicumSummary.roster.length === 0) return;

    const headers = [
      'Student Number',
      'Full Name',
      'Email',
      'Department',
      'Course',
      'Year Level',
      'Host Company',
      'Supervisor',
      'Required Hours',
      'Completed Hours',
      'Remaining Hours',
      'Progress %',
      'Midterm Score',
      'Final Score',
      'Clearance Status',
      'Certificate Issued',
      'Verification Code',
    ];

    const rows = practicumSummary.roster.map((r) => [
      `"${r.student_number}"`,
      `"${r.full_name.replace(/"/g, '""')}"`,
      `"${r.email}"`,
      `"${r.department}"`,
      `"${r.course}"`,
      r.year_level,
      `"${r.company_name.replace(/"/g, '""')}"`,
      `"${r.supervisor_name.replace(/"/g, '""')}"`,
      r.required_hours,
      r.completed_hours,
      r.remaining_hours,
      `${r.progress_percentage}%`,
      r.midterm_score !== null ? r.midterm_score : 'N/A',
      r.final_score !== null ? r.final_score : 'N/A',
      `"${r.clearance_status}"`,
      r.certificate_issued ? 'YES' : 'NO',
      `"${r.certificate_code || 'N/A'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CDM_OJT_Practicum_Roster_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteBackup = async () => {
    setBackupConfirmOpen(false);
    setBackupLoading(true);
    try {
      const res = await generateDatabaseSnapshot();
      if (res.data) {
        setBackupResult(res.data);
        // Automatically trigger JSON download in browser
        const blob = new Blob([res.data.snapshot_json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CDM_OJT_Database_Backup_${res.data.timestamp.replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setMsg({
          type: 'success',
          text: `Institutional database backup generated successfully (${(res.data.file_size_bytes / 1024).toFixed(1)} KB). SHA-256 Checksum computed.`,
        });
        loadAudit();
      } else if (res.error) {
        setMsg({ type: 'error', text: res.error.message || 'Failed to generate database snapshot.' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Error during database backup generation.' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: AccountStatus) => {
    setLoadingId(userId);
    setMsg(null);
    const result = await updateUserAccountStatus(userId, newStatus);
    setLoadingId(null);

    if (result.error) {
      setMsg({ type: 'error', text: result.error.message });
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, account_status: newStatus } : u))
      );
      setMsg({ type: 'success', text: `User account status updated to ${newStatus}.` });
      loadAudit();
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;

    setDeleteLoading(true);
    setDeleteError('');
    const res = await deleteSystemUser(deleteTarget.user_id);
    setDeleteLoading(false);

    if (res.error) {
      setDeleteError(res.error.message);
      return;
    }

    setMsg({
      type: 'success',
      text: `Successfully deleted account for ${deleteTarget.full_name} (${deleteTarget.email}).`,
    });
    setDeleteTarget(null);
    fetchUsers(page, roleFilter, statusFilter, searchQuery);
    loadAudit();
  };
  const handleOpenResetPasswordModal = (u: UserManagementItem) => {
    setUserToReset(u);
    setCustomResetPassword(`CdM@${Math.floor(100000 + Math.random() * 900000)}!`);
    setGeneratedPasswordResult(null);
    setCopied(false);
    setResetModalOpen(true);
  };

  const handleGenerateRandomPassword = () => {
    setCustomResetPassword(`CdM@${Math.floor(100000 + Math.random() * 900000)}!`);
  };

  const confirmAdminPasswordReset = async () => {
    if (!userToReset) return;
    setResetPasswordLoading(true);
    const res = await adminResetUserPassword(userToReset.user_id, customResetPassword);
    setResetPasswordLoading(false);

    if (res.error) {
      setMsg({ type: 'error', text: res.error.message });
    } else {
      const tempPw = res.data?.temporaryPassword || customResetPassword;
      setGeneratedPasswordResult(tempPw);
      setMsg({
        type: 'success',
        text: `Password for "${userToReset.full_name}" has been securely updated. Provide the temporary credentials to the user.`,
      });
      loadAudit();
    }
  };

  const handleCopyPassword = () => {
    if (generatedPasswordResult || customResetPassword) {
      navigator.clipboard.writeText(generatedPasswordResult || customResetPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };


  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');

    const res = await createSystemUser(staffForm);
    setCreateLoading(false);

    if (res.error) {
      setCreateError(res.error.message);
      return;
    }

    setMsg({
      type: 'success',
      text: `Successfully provisioned ${staffForm.role} account for ${staffForm.full_name}.`,
    });
    setCreateModalOpen(false);
    setStaffForm({
      full_name: '',
      email: '',
      password: '',
      role: 'Coordinator',
      department_or_program: 'ICS',
      employee_number: `${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    });
    fetchUsers(page, roleFilter, statusFilter, searchQuery);
    loadAudit();
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anncTitle.trim() || !anncContent.trim()) return;

    setAnncLoading(true);
    setMsg(null);
    const result = await createAnnouncement({
      title: anncTitle,
      content: anncContent,
      target_department: anncDept,
      target_role: 'All',
      delivery_type: anncDeliveryType,
    });
    setAnncLoading(false);

    if (result.error) {
      setMsg({ type: 'error', text: result.error.message });
    } else {
      setAnncTitle('');
      setAnncContent('');
      setIsBroadcastFormOpen(false);
      setIsActiveBroadcastsOpen(true);
      setMsg({
        type: 'success',
        text: anncDeliveryType === 'alert'
          ? 'Urgent alert published and dispatched with 🚨 icon to all user inboxes!'
          : 'Announcement published and dispatched with 📢 icon to all user inboxes!',
      });
      loadAnnouncements();
      loadAudit();
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(totalCount, page * PAGE_SIZE);

  return (
    <div className="space-y-4 max-w-6xl p-4 sm:p-6 lg:p-8 page-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A3D24] dark:text-emerald-400 hover:text-[#062415] hover:underline mb-1 transition-colors cursor-pointer"
          >
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">System Administration</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage user accounts, provision academic staff, and broadcast campus announcements.
          </p>
        </div>
        <div>
          <Button
            onClick={() => { setCreateError(''); setCreateModalOpen(true); }}
            className="bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer active:scale-95"
          >
            + Create Staff Account
          </Button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-xl text-sm font-medium flex items-center justify-between gap-2 transition-all ${
            msg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === 'success' ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* System Metrics Cards - Standardized Heights & Micro-interactions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="group h-full min-h-[104px] border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 hover:-translate-y-0.5 cursor-default bg-white dark:bg-slate-900">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3.5 h-full">
            <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105">
              <Users className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Users</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5 leading-tight">{overview.totalUsers}</h3>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{overview.activeUsers} active accounts</p>
            </div>
          </CardContent>
        </Card>

        <Card className="group h-full min-h-[104px] border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 hover:-translate-y-0.5 cursor-default bg-white dark:bg-slate-900">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3.5 h-full">
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Approvals</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5 leading-tight">{overview.pendingUsers}</h3>
              <p className="text-xs text-slate-400 mt-0.5 truncate">Awaiting verification</p>
            </div>
          </CardContent>
        </Card>

        <Card className="group h-full min-h-[104px] border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 hover:-translate-y-0.5 cursor-default bg-white dark:bg-slate-900">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3.5 h-full">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105">
              <Building className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Partner Companies</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5 leading-tight">{overview.companiesCount}</h3>
              <p className="text-xs text-slate-400 mt-0.5 truncate">Active establishments</p>
            </div>
          </CardContent>
        </Card>

        <Card className="group h-full min-h-[104px] border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 hover:-translate-y-0.5 cursor-default bg-white dark:bg-slate-900">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3.5 h-full">
            <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recorded Shifts</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5 leading-tight">{overview.attendanceCount}</h3>
              <p className="text-xs text-slate-400 mt-0.5 truncate">Total verified logs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Level Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <button
            type="button"
            onClick={() => setMainTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              mainTab === 'users'
                ? 'bg-white dark:bg-slate-900 text-[#0A3D24] dark:text-emerald-400 shadow-xs ring-1 ring-slate-200/50 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            User Directory
          </button>
          <button
            type="button"
            onClick={() => setMainTab('reports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              mainTab === 'reports'
                ? 'bg-white dark:bg-slate-900 text-[#0A3D24] dark:text-emerald-400 shadow-xs ring-1 ring-slate-200/50 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Practicum Reports
          </button>
          <button
            type="button"
            onClick={() => setMainTab('backups')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              mainTab === 'backups'
                ? 'bg-white dark:bg-slate-900 text-[#0A3D24] dark:text-emerald-400 shadow-xs ring-1 ring-slate-200/50 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            Database &amp; Backups
          </button>
        </div>

        {mainTab === 'reports' && (
          <Button
            onClick={handleExportRosterCSV}
            disabled={!practicumSummary?.roster || practicumSummary.roster.length === 0}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Roster (CSV)
          </Button>
        )}

        {mainTab === 'backups' && (
          <Button
            onClick={() => setBackupConfirmOpen(true)}
            disabled={backupLoading}
            className="bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold text-xs gap-1.5 shadow-xs cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            Create Backup Snapshot
          </Button>
        )}
      </div>

      {mainTab === 'users' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* User Management Section - Distinct Panel Container */}
          <section className="lg:col-span-2 space-y-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-800 dark:text-emerald-400 shrink-0" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">User Management &amp; Status Control</h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Search, filter by role/status, activate, or permanently delete accounts.
                </p>
              </div>
              <span className="text-xs font-medium px-3.5 py-1 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 self-start sm:self-auto shadow-2xs">
                Total {totalCount} account{totalCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Header Layout: Search Bar, Dropdown Selector & Horizontally Spacious Tab Bar */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Spacious Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0A3D24] dark:focus:border-emerald-500 focus:ring-1 focus:ring-[#0A3D24]/15 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => handleSearchChange('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Elegant 'All Statuses' Dropdown Selector */}
                <div className="relative shrink-0 flex items-center">
                  <div className="relative w-full sm:w-auto">
                    <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
                    <select
                      value={statusFilter}
                      onChange={(e) => handleStatusFilterChange(e.target.value)}
                      className="w-full sm:w-auto pl-8.5 pr-8 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200 outline-none hover:border-slate-300 dark:hover:border-slate-600 focus:border-[#0A3D24] dark:focus:border-emerald-500 cursor-pointer appearance-none shadow-2xs"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active Accounts</option>
                      <option value="pending">Pending Verification</option>
                      <option value="inactive">Inactive Accounts</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Un-cropped, Horizontally Spacious Tab Selection Bar with Inline Pagination */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                  {ROLE_TABS.map((tab) => {
                    const isActive = roleFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleRoleChange(tab.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
                          isActive
                            ? 'bg-[#D1F2DF] text-[#15803D] border border-[#A7F3D0] dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-semibold shadow-2xs'
                            : 'bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Inline Pagination: < 1 of 10 pages > */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto text-xs text-slate-600 dark:text-slate-400">
                  <button
                    type="button"
                    disabled={page <= 1 || tableLoading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="w-6 h-6 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer transition-colors"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 font-medium whitespace-nowrap">
                    {page} of {Math.max(1, totalPages)} {Math.max(1, totalPages) === 1 ? 'page' : 'pages'}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages || tableLoading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="w-6 h-6 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer transition-colors"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Beautifully Balanced Data Table with Spacious Horizontal Margins */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">USER</th>
                      <th className="px-6 py-3.5">ROLE</th>
                      <th className="px-6 py-3.5">STATUS</th>
                      <th className="px-6 py-3.5 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tableError ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-xs text-red-600 bg-red-50/40 dark:bg-red-950/20">
                          <div className="flex flex-col items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            <p className="font-semibold">{tableError}</p>
                            <button
                              onClick={() => fetchUsers(page, roleFilter, statusFilter, searchQuery)}
                              className="mt-1 px-3.5 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-800 dark:text-red-200 font-semibold transition-colors cursor-pointer text-xs"
                            >
                              Retry Loading Users
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : tableLoading ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-xs text-slate-400">
                          <div className="flex items-center justify-center gap-2.5">
                            <div className="w-4 h-4 border-2 border-[#0A3D24] dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            <span className="font-medium text-slate-500">Loading directory...</span>
                          </div>
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                          <p className="font-semibold text-slate-700 dark:text-slate-200">No users match the current criteria.</p>
                          <p className="text-[11px] text-slate-400 mt-1">Try adjusting your search query or clearing the filter.</p>
                          {(roleFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
                            <button
                              onClick={() => {
                                setSearchQuery('');
                                setStatusFilter('all');
                                handleRoleChange('all');
                              }}
                              className="mt-3 px-3.5 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition-colors cursor-pointer"
                            >
                              Clear Filters &amp; Show All
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        return (
                          <tr key={u.user_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            {/* USER Column: Name + Inline ID Badge + Email Underneath */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                                  {u.full_name}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  ID: {u.employee_number || u.user_id.slice(0, 8)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {u.email}
                              </p>
                            </td>

                            {/* ROLE Column: Pill with dot */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#EEF2F6] text-[#334155] border border-[#E2E8F0] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-400" />
                                {u.role === 'ProgramHead' ? 'Program Head' : u.role}
                              </span>
                            </td>

                            {/* STATUS Column: Soft Vibrant Light-Green Active Indicator */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              {u.account_status === 'active' ? (
                                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60">
                                  active
                                </span>
                              ) : u.account_status === 'pending' ? (
                                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60">
                                  pending
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                  inactive
                                </span>
                              )}
                            </td>

                            {/* ACTIONS Column: Modern Flat-Style Pill Buttons + Compressed Delete Button */}
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-2">
                                {u.account_status === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(u.user_id, 'active')}
                                    disabled={loadingId === u.user_id}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                                  >
                                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>Approve</span>
                                  </button>
                                )}
                                {u.account_status === 'active' && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(u.user_id, 'inactive')}
                                    disabled={loadingId === u.user_id}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                                    <span>Deactivate</span>
                                  </button>
                                )}
                                {u.account_status === 'inactive' && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(u.user_id, 'active')}
                                    disabled={loadingId === u.user_id}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                                    <span>Reactivate</span>
                                  </button>
                                )}

                                {/* Pill Reset Password Button */}
                                <button
                                  type="button"
                                  title="Reset User Password"
                                  onClick={() => handleOpenResetPasswordModal(u)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-all cursor-pointer"
                                >
                                  <Key className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                                  <span>Reset Password</span>
                                </button>

                                {/* Compressed Delete Button */}
                                <button
                                  type="button"
                                  title="Permanently Delete Account"
                                  onClick={() => { setDeleteError(''); setDeleteTarget(u); }}
                                  className="w-7 h-7 inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            {/* Table Pagination Footer */}
            {totalCount > 0 && (
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Showing <strong className="text-slate-700 dark:text-slate-200">{startIndex}</strong> to{' '}
                  <strong className="text-slate-700 dark:text-slate-200">{endIndex}</strong> of{' '}
                  <strong className="text-slate-700 dark:text-slate-200">{totalCount}</strong> users
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Page {page} of {totalPages}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1 || tableLoading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="h-7 px-2 border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages || tableLoading}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="h-7 px-2 border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Campus Broadcasts & Announcements (Minimizable Accordions) */}
        <section className="space-y-3">
          {/* 1. Minimized Broadcast Form Card */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all">
            <div
              onClick={() => setIsBroadcastFormOpen(prev => !prev)}
              className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors select-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-[#0A3D24] dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">Broadcast Campus Announcement</h2>
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/50 hidden sm:inline">
                      Inbox Dispatch
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {isBroadcastFormOpen ? 'Fill in details below to publish to dashboards' : 'Click to compose bulletin or emergency alert to trainee and staff inboxes'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-xs font-bold text-[#0A3D24] dark:text-emerald-400">
                  {isBroadcastFormOpen ? 'Minimize' : '+ New Broadcast'}
                </span>
                <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isBroadcastFormOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>

            {isBroadcastFormOpen && (
              <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                <form onSubmit={handlePublishAnnouncement} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Subject / Title</label>
                      <Input
                        placeholder="e.g. Practicum Orientation Schedule"
                        value={anncTitle}
                        onChange={(e) => setAnncTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Target Institute / Department</label>
                      <select
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:border-[#0A3D24] focus:ring-1 focus:ring-[#0A3D24] transition-all cursor-pointer"
                        value={anncDept}
                        onChange={(e) => setAnncDept(e.target.value)}
                      >
                        <option value="All">All Departments (Campus-wide)</option>
                        <option value="ICS">Institute of Computing Studies (ICS)</option>
                        <option value="IBE">Institute of Business and Entrepreneurship (IBE)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Broadcast Message</label>
                    <textarea
                      className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:border-[#0A3D24] focus:ring-1 focus:ring-[#0A3D24] min-h-[75px] transition-all"
                      placeholder="Enter the broadcast notice message for all system users..."
                      value={anncContent}
                      onChange={(e) => setAnncContent(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAnncDeliveryType('announcement')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          anncDeliveryType === 'announcement'
                            ? 'bg-[#0A3D24] text-[#FFCC00] shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        📢 General Notice
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnncDeliveryType('alert')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          anncDeliveryType === 'alert'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        🚨 Urgent Alert
                      </button>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsBroadcastFormOpen(false)}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Minimize
                      </Button>
                      <Button
                        type="submit"
                        className="bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold text-xs cursor-pointer shadow-xs"
                        loading={anncLoading}
                      >
                        {anncDeliveryType === 'alert' ? 'Publish Urgent Alert (🚨)' : 'Publish Announcement (📢)'}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* 2. Minimized Active Broadcasts Card */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all">
            <div
              onClick={() => setIsActiveBroadcastsOpen(prev => !prev)}
              className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors select-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Broadcasts</h3>
                    <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 text-[10px] font-bold">
                      {announcements.length} Posted
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {announcements.length === 0
                      ? 'No active broadcasts currently posted'
                      : `Latest: "${announcements[0]?.title}" • Click to ${isActiveBroadcastsOpen ? 'minimize' : 'expand'}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadAnnouncements();
                  }}
                  className="text-xs font-bold text-[#0A3D24] dark:text-emerald-400 hover:underline px-2 py-1 cursor-pointer"
                >
                  Refresh
                </button>
                <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isActiveBroadcastsOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>

            {isActiveBroadcastsOpen && (
              <div className="border-t border-slate-100 dark:border-slate-800">
                {anncListLoading ? (
                  <div className="p-6 text-center text-xs text-slate-400">Loading broadcasts...</div>
                ) : announcements.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No active broadcasts currently posted.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[300px] overflow-y-auto">
                    {announcements.map((annc) => (
                      <div key={annc.announcement_id} className="p-3.5 sm:p-4 flex items-start justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-[#0A3D24] text-[#FFCC00] uppercase tracking-wider">
                              {annc.target_department === 'All' ? 'Campus-Wide' : `${annc.target_department} Dept`}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {new Date(annc.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">{annc.title}</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{annc.content}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncementClick(annc)}
                          title="Permanently delete announcement"
                          className="text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* System Security & Audit Trail */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0A3D24]" />
            <h2 className="text-lg font-bold text-slate-900">System Activity & Security Audit Trail</h2>
          </div>
          <Button size="sm" variant="outline" onClick={loadAudit} disabled={auditLoading} className="text-xs h-7 cursor-pointer">
            Refresh Log
          </Button>
        </div>

        <Card className="border-slate-200/80 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {auditLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading audit records...</div>
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <p className="font-semibold text-slate-700">No security audit events recorded yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Administrative actions (account approvals, status changes, announcements, user deletions) are automatically logged.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Security Action</th>
                      <th className="px-4 py-3">Target Entity</th>
                      <th className="px-4 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {auditLogs.map((log) => (
                      <tr key={log.log_id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-sans">
                          <span className="font-semibold text-slate-800">{log.actor_name}</span>
                          <span className="text-[10px] text-slate-400 block">{log.actor_role}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-bold">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)}...)` : ''}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 font-sans text-[11px]">
                          {JSON.stringify(log.details)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </>
      )}

      {/* ========================================================================= */}
      {/* PRACTICUM & PLACEMENT REPORTS TAB (INCREMENT 9) */}
      {/* ========================================================================= */}
      {mainTab === 'reports' && (
        <div className="space-y-6">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#0A3D24] dark:text-emerald-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Practicum & Placement Analytics</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Colegio de Montalban • 4th-Year OJT Monitoring & Completion Records (ICS & IBE)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadPracticumReports(reportProgramFilter)}
                disabled={reportsLoading}
                className="text-xs h-8 cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${reportsLoading ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
              <Button
                size="sm"
                onClick={handleExportRosterCSV}
                disabled={!practicumSummary?.roster || practicumSummary.roster.length === 0}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-8 gap-1.5 shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export Roster CSV ({practicumSummary?.roster?.length || 0})
              </Button>
            </div>
          </div>

          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-200/80 dark:border-slate-800 shadow-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Trainees</span>
                  <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {practicumSummary?.kpis?.totalTrainees ?? '...'}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">Enrolled</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">ICS: {practicumSummary?.kpis?.icsCount ?? 0}</span>
                  <span>•</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-400">IBE: {practicumSummary?.kpis?.ibeCount ?? 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 dark:border-slate-800 shadow-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Placement Rate</span>
                  <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {practicumSummary?.kpis?.placementRate ?? 0}%
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    ({practicumSummary?.kpis?.placedTrainees ?? 0} / {practicumSummary?.kpis?.totalTrainees ?? 0})
                  </span>
                </div>
                <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${practicumSummary?.kpis?.placementRate ?? 0}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 dark:border-slate-800 shadow-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Clearance Completion</span>
                  <Check className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {practicumSummary?.kpis?.completionRate ?? 0}%
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    ({practicumSummary?.kpis?.completedTrainees ?? 0} Cleared)
                  </span>
                </div>
                <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-teal-600 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${practicumSummary?.kpis?.completionRate ?? 0}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 dark:border-slate-800 shadow-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Deficiencies / At Risk</span>
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {practicumSummary?.kpis?.deficientCount ?? 0}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">Students</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Unassigned or 0 rendered hours</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Roster Filter Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter:
              </span>
              {[
                { id: 'all', label: 'All Programs' },
                { id: 'ICS', label: 'ICS Department' },
                { id: 'IBE', label: 'IBE Department' },
                { id: 'BSIT', label: 'BSIT' },
                { id: 'BS-CpE', label: 'BS-CpE' },
                { id: 'BSBA-HRM', label: 'BSBA-HRM' },
                { id: 'BSEntrep', label: 'BSEntrep' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setReportProgramFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reportProgramFilter === tab.id
                      ? 'bg-[#0A3D24] text-[#FFCC00] shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search trainee, student #, company..."
                value={reportSearchQuery}
                onChange={(e) => setReportSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0A3D24]"
              />
            </div>
          </div>

          {/* Roster Table Card */}
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
            <CardContent className="p-0">
              {reportsLoading ? (
                <div className="p-12 text-center text-xs text-slate-400">Loading practicum roster records...</div>
              ) : reportsError ? (
                <div className="p-8 text-center text-xs text-rose-600 bg-rose-50/50 dark:bg-rose-950/20">
                  {reportsError}
                </div>
              ) : !practicumSummary?.roster || practicumSummary.roster.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  <p className="font-bold text-slate-700 dark:text-slate-300">No student practicum records found.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Student profiles and placements will appear here once registered and approved.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Student Trainee</th>
                        <th className="px-4 py-3">Program / Dept</th>
                        <th className="px-4 py-3">Host Company &amp; Supervisor</th>
                        <th className="px-4 py-3">Rendered Hours</th>
                        <th className="px-4 py-3 text-center">Midterm / Final</th>
                        <th className="px-4 py-3 text-center">Clearance Status</th>
                        <th className="px-4 py-3 text-right">Certificate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {practicumSummary.roster
                        .filter((item) => {
                          if (!reportSearchQuery) return true;
                          const q = reportSearchQuery.toLowerCase();
                          return (
                            item.full_name.toLowerCase().includes(q) ||
                            item.student_number.toLowerCase().includes(q) ||
                            item.company_name.toLowerCase().includes(q) ||
                            item.supervisor_name.toLowerCase().includes(q)
                          );
                        })
                        .map((row) => (
                          <tr key={row.student_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900 dark:text-white leading-tight">
                                {row.full_name}
                              </div>
                              <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                                {row.student_number || 'No ID'} • {row.email}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded ${
                                row.department === 'ICS'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              }`}>
                                {row.course || row.department}
                              </span>
                              <span className="block text-[10px] text-slate-400 mt-0.5">
                                Year {row.year_level}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                                {row.company_name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Supv: {row.supervisor_name}
                              </div>
                            </td>
                            <td className="px-4 py-3 min-w-[140px]">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {row.completed_hours} hrs
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  / {row.required_hours} hrs ({row.progress_percentage}%)
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-300 ${
                                    row.progress_percentage >= 100
                                      ? 'bg-emerald-600'
                                      : row.progress_percentage >= 50
                                      ? 'bg-blue-600'
                                      : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(100, row.progress_percentage)}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 text-[11px]">
                                <span className={`px-1.5 py-0.5 rounded font-bold ${
                                  row.midterm_score !== null
                                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                }`}>
                                  M: {row.midterm_score !== null ? row.midterm_score : '—'}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded font-bold ${
                                  row.final_score !== null
                                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                }`}>
                                  F: {row.final_score !== null ? row.final_score : '—'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                row.clearance_status === 'Cleared'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : row.clearance_status === 'In Progress'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              }`}>
                                {row.clearance_status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {row.certificate_issued ? (
                                <div className="inline-flex flex-col items-end">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                    <Check className="w-3 h-3" /> Issued
                                  </span>
                                  {row.certificate_code && (
                                    <span className="font-mono text-[9px] text-slate-400 mt-0.5">
                                      {row.certificate_code}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 font-medium">Pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DATABASE & BACKUPS TAB (ISO/IEC 25010:2023 & RA 10173 COMPLIANT) */}
      {/* ========================================================================= */}
      {mainTab === 'backups' && (
        <div className="space-y-6">
          {/* Compliance & Standard Card */}
          <div className="p-6 rounded-2xl bg-[#0A3D24] text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
              <Database className="w-64 h-64 text-[#FFCC00]" />
            </div>
            <div className="max-w-2xl relative z-10 space-y-3">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 text-[#FFCC00] text-[11px] font-extrabold uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" />
                ISO/IEC 25010:2023 &amp; RA 10173 Compliant
              </div>
              <h2 className="text-xl font-black tracking-tight text-white">
                Institutional Database Snapshot &amp; Archive
              </h2>
              <p className="text-xs text-emerald-100/90 leading-relaxed">
                Execute a verified, point-in-time relational backup of all Colegio de Montalban OJT records.
                Archives encompass student directories, pre-deployment agreements, supervisor evaluations, GPS attendance records, and completion certificates.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => setBackupConfirmOpen(true)}
                  disabled={backupLoading}
                  className="bg-[#FFCC00] hover:bg-[#e6b800] text-[#0A3D24] font-black text-xs h-9 px-4 rounded-xl shadow-xs cursor-pointer gap-2"
                >
                  <Database className="w-4 h-4" />
                  {backupLoading ? 'Generating Snapshot...' : 'Generate New Database Backup'}
                </Button>
                <span className="text-[11px] text-emerald-200">
                  Strictly excludes user password hashes &amp; auth secrets
                </span>
              </div>
            </div>
          </div>

          {/* Snapshot Result or Prompt */}
          {backupResult ? (
            <div className="space-y-4">
              <Card className="border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-200/60 dark:border-emerald-800/60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
                        <Check className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Verified Snapshot Available
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Generated on {new Date(backupResult.timestamp).toLocaleString()} • Total Size: {(backupResult.file_size_bytes / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        const blob = new Blob([backupResult.snapshot_json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `CDM_OJT_Database_Backup_${backupResult.timestamp.replace(/[:.]/g, '-')}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-8 gap-1.5 cursor-pointer shadow-2xs shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download JSON File
                    </Button>
                  </div>

                  {/* SHA-256 Checksum Bar */}
                  <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        SHA-256 Checksum (Data Integrity Seal)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(backupResult.sha256_checksum);
                          setBackupCopied(true);
                          setTimeout(() => setBackupCopied(false), 2000);
                        }}
                        className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {backupCopied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {backupCopied ? 'Copied' : 'Copy Hash'}
                      </button>
                    </div>
                    <p className="font-mono text-xs text-slate-700 dark:text-slate-300 break-all select-all">
                      {backupResult.sha256_checksum}
                    </p>
                  </div>

                  {/* Record Counts Breakdown Grid */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                      Included Relational Records ({Object.values(backupResult.table_counts).reduce((a, b) => a + b, 0)} Total)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                      {Object.entries(backupResult.table_counts).map(([table, count]) => (
                        <div
                          key={table}
                          className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center"
                        >
                          <span className="font-bold text-slate-900 dark:text-white block text-sm">{Number(count)}</span>
                          <span className="text-[10px] text-slate-400 capitalize truncate block">
                            {table.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-slate-200/90 dark:border-slate-800 shadow-xs">
              <CardContent className="p-8 text-center space-y-2">
                <Database className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Local Snapshot Active</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Click &ldquo;Generate New Database Backup&rdquo; above to query live Supabase PostgreSQL tables and compile an audited institutional archive.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Backup Specifications */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600" /> Non-Repudiation
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Every snapshot export generates an immutable entry in the administrative audit trail documenting the acting administrator, timestamp, and byte size.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Building className="w-4 h-4 text-blue-600" /> Accreditation Readiness
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Exports satisfy CHED and ISO/IEC 25010 requirements for institutional documentation of student internships across ICS and IBE programs.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" /> Disaster Recovery
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Complete relational entities can be inspected or restored without schema conflict via standardized PostgreSQL tables.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete User Confirmation */}
      <Modal
        title="Permanently Delete User Account"
        open={!!deleteTarget}
        onClose={() => { if (!deleteLoading) setDeleteTarget(null); }}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-900">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Warning: This action is permanent and irreversible.</p>
              <p className="text-red-700 leading-relaxed">
                Deleting this account will permanently revoke their access and remove their identity from Supabase Auth.
              </p>
            </div>
          </div>

          {deleteTarget && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">User Name:</span>
                <span className="font-bold text-slate-900">{deleteTarget.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Email Address:</span>
                <span className="font-mono text-slate-700">{deleteTarget.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Assigned Role:</span>
                <Badge variant="outline" className="text-[10px] font-bold">
                  {deleteTarget.role}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Current Status:</span>
                <span className="font-semibold text-slate-700 uppercase text-[10px]">
                  {deleteTarget.account_status}
                </span>
              </div>
            </div>
          )}

          {deleteError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
              {deleteError}
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={deleteLoading}
              onClick={() => setDeleteTarget(null)}
              className="flex-1 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={deleteLoading}
              onClick={handleDeleteUser}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
            >
              Permanently Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Create Staff Account */}
      <Modal title="Provision Academic Staff Account" open={createModalOpen} onClose={() => setCreateModalOpen(false)}>
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="e.g. Prof. Maria Santos"
            value={staffForm.full_name}
            onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })}
            required
          />

          <Input
            label="Institutional Email"
            type="email"
            placeholder="e.g. msantos@cdm.edu.ph"
            value={staffForm.email}
            onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
            required
          />

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">CdM Employee ID Number</label>
              <button
                type="button"
                onClick={() =>
                  setStaffForm({
                    ...staffForm,
                    employee_number: `${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
                  })
                }
                className="text-[11px] font-bold text-[#0A3D24] hover:underline cursor-pointer"
              >
                🎲 Generate ID
              </button>
            </div>
            <Input
              placeholder="e.g. 2024-001"
              value={staffForm.employee_number || ''}
              onChange={(e) => setStaffForm({ ...staffForm, employee_number: e.target.value })}
              required
            />
          </div>

          <Input
            label="Temporary Password (Min. 8 characters)"
            type="password"
            placeholder="        "
            value={staffForm.password}
            onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Account Role</label>
              <select
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-slate-900"
                value={staffForm.role}
                onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as any })}
              >
                <option value="Coordinator">OJT Coordinator</option>
                <option value="ProgramHead">Program Head</option>
                <option value="Admin">System Administrator</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Department / Institute</label>
              <select
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white outline-none focus:border-[#0A3D24]"
                value={staffForm.department_or_program}
                onChange={(e) => setStaffForm({ ...staffForm, department_or_program: e.target.value })}
              >
                <option value="ICS">Institute of Computing Studies (ICS)</option>
                <option value="IBE">Institute of Business and Entrepreneurship (IBE)</option>
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                💡 <em>Example: Scopes coordinator or program head assignments to ICS (Computing) or IBE (Business).</em>
              </p>
            </div>
          </div>

          {createError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
              {createError}
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createLoading}
              className="flex-1 bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold"
            >
              Create & Activate
            </Button>
          </div>
        </form>
      </Modal>
      {/* Admin Direct Password Reset Override Modal */}
      {resetModalOpen && userToReset && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 page-fade-in">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Direct Password Reset Override</h3>
                <p className="text-xs text-slate-500">Administrator Security Control</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs space-y-1">
              <p className="font-bold text-slate-800">{userToReset.full_name}</p>
              <p className="text-slate-600">{userToReset.email}</p>
              <p className="text-[10px] text-slate-400 pt-0.5">Role: <span className="font-bold uppercase text-[#0A3D24]">{userToReset.role}</span></p>
            </div>

            {!generatedPasswordResult ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Temporary Password</label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomPassword}
                      className="text-[11px] font-bold text-[#0A3D24] hover:underline cursor-pointer"
                    >
                      🎲 Generate New
                    </button>
                  </div>
                  <Input
                    type="text"
                    value={customResetPassword}
                    onChange={(e) => setCustomResetPassword(e.target.value)}
                    placeholder="Enter minimum 8 characters..."
                    required
                  />
                  <p className="text-[11px] text-slate-400">
                    The user will be able to log in immediately and update this password in their Account Settings.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setResetModalOpen(false); setUserToReset(null); }}
                    disabled={resetPasswordLoading}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={confirmAdminPasswordReset}
                    loading={resetPasswordLoading}
                    className="bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold cursor-pointer"
                  >
                    <Key className="w-4 h-4 mr-1.5" />
                    Apply Password Reset
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 page-fade-in">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-emerald-900">
                    ✅ Password Reset Successfully Applied!
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    Copy and provide these temporary login credentials to the user:
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      readOnly
                      value={generatedPasswordResult}
                      className="w-full font-mono font-bold text-sm bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-slate-900 select-all outline-none"
                    />
                    <Button
                      size="sm"
                      onClick={handleCopyPassword}
                      className="shrink-0 bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                    >
                      {copied ? <CheckCheck className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={() => { setResetModalOpen(false); setUserToReset(null); setGeneratedPasswordResult(null); }}
                    className="bg-slate-900 hover:bg-slate-800 text-white cursor-pointer font-bold"
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Permanent Delete Announcement Confirmation Modal */}
      {deleteAnncModalOpen && anncToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 page-fade-in">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Broadcast Notice?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs space-y-1">
              <p className="font-bold text-slate-800">{anncToDelete.title}</p>
              <p className="text-slate-600 line-clamp-2">{anncToDelete.content}</p>
              <p className="text-[10px] text-slate-400 pt-1">
                Target: {anncToDelete.target_department === 'All' ? 'Campus-Wide' : anncToDelete.target_department} • {new Date(anncToDelete.created_at).toLocaleDateString()}
              </p>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Permanently deleting this announcement will remove it from all student, coordinator, and faculty dashboards across the system immediately.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setDeleteAnncModalOpen(false); setAnncToDelete(null); }}
                disabled={deleteAnncLoading}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmDeleteAnnouncement}
                loading={deleteAnncLoading}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete Announcement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Institutional Database Backup Confirmation Modal */}
      {backupConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 page-fade-in">
            <div className="flex items-center gap-3 text-[#0A3D24] dark:text-emerald-400 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 text-[#0A3D24] dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Generate Database Backup Snapshot</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Institutional Archive &amp; Audit</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl mb-4 text-xs space-y-2">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                This process queries live academic records across 13 core database tables:
              </p>
              <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-0.5 text-[11px]">
                <li>Students, User Profiles, Host Companies</li>
                <li>Practicum Assignments &amp; Verified Attendance</li>
                <li>Weekly Accomplishment Reports &amp; Evaluations</li>
                <li>Completion Certificates &amp; Security Audit Logs</li>
              </ul>
              <div className="pt-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                • In accordance with RA 10173, passwords, session tokens, and OTP secrets are strictly excluded.
                <br />
                • A SHA-256 cryptographic checksum is appended to verify archive authenticity.
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
              Once generated, a sanitized JSON archive will automatically download to your workstation and an immutable record will be logged to the security audit trail.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBackupConfirmOpen(false)}
                disabled={backupLoading}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteBackup}
                loading={backupLoading}
                className="bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold cursor-pointer"
              >
                <Database className="w-4 h-4 mr-1.5" />
                Confirm &amp; Export Backup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
