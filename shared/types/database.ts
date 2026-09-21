import type { UserRole, AccountStatus } from './roles';

export type { UserRole, AccountStatus };

export type StudentStatus = 'active' | 'completed' | 'dropped' | 'failed' | 'withdrawn';
export type AssignmentStatus = 'active' | 'completed' | 'terminated' | 'reassigned';

export interface DbUser {
  user_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  account_status: AccountStatus;
  employee_number?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbStudent {
  student_id: string;
  user_id: string;
  student_number: string;
  course: string;
  year_level: number;
  required_hours: number | null;
  status: StudentStatus;
  users?: DbUser;
}

export interface DbCoordinator {
  coordinator_id: string;
  user_id: string;
  department: string;
}

export interface DbSupervisor {
  supervisor_id: string;
  user_id: string;
  company_id: string;
  position: string;
  users?: DbUser;
  companies?: DbCompany;
}

export interface DbProgramHead {
  program_head_id: string;
  user_id: string;
  department_or_program: string;
}

export interface DbAdmin {
  admin_id: string;
  user_id: string;
}

export interface DbCompany {
  company_id: string;
  company_name: string;
  address: string;
  contact_person: string;
  contact_email: string;
  contact_number: string;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_meters?: number;
  geofence_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbStudentAssignment {
  assignment_id: string;
  student_id: string;
  company_id: string;
  supervisor_id: string;
  start_date: string;
  end_date: string | null;
  assignment_status: AssignmentStatus;
  created_at: string;
}

export type QrValidationStatus = 'valid' | 'invalid' | 'expired';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type LateStatus = 'on_time' | 'late' | 'unknown';
export type SyncStatus = 'synced' | 'pending_sync' | 'conflict';
export type LocationStatus = 'verified' | 'flagged_out_of_bounds' | 'location_unavailable' | 'not_applicable';

export interface DbAttendance {
  attendance_id: string;
  student_id: string;
  assignment_id: string;
  attendance_date: string;
  time_in: string;
  time_out: string | null;
  time_in_selfie_path: string;
  time_out_selfie_path: string | null;
  qr_validation_status?: QrValidationStatus;
  verification_status: VerificationStatus;
  late_status: LateStatus;
  sync_status: SyncStatus;
  time_in_lat?: number | null;
  time_in_lng?: number | null;
  time_in_distance_meters?: number | null;
  time_in_location_status?: LocationStatus;
  time_in_flag_reason?: string | null;
  time_out_lat?: number | null;
  time_out_lng?: number | null;
  time_out_distance_meters?: number | null;
  time_out_location_status?: LocationStatus;
  time_out_flag_reason?: string | null;
  synced_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type ReportStatus = 'submitted' | 'reviewed' | 'approved' | 'rejected';

export interface DbReport {
  report_id: string;
  student_id: string;
  report_type: string;
  file_path: string;
  submission_date: string;
  status: ReportStatus;
  remarks: string | null;
  supervisor_feedback?: string | null;
  supervisor_endorsed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type EvaluationType = 'midterm' | 'final';

export interface DbEvaluation {
  evaluation_id: string;
  student_id: string;
  supervisor_id: string;
  performance_score: number | null;
  feedback: string;
  evaluation_date: string;
  evaluation_type?: EvaluationType;
  rubric_scores?: Record<string, number> | null;
  created_at: string;
}

export type NotificationStatus = 'unread' | 'read';

export interface DbNotification {
  notification_id: string;
  sender_user_id: string | null;
  receiver_user_id: string;
  message: string;
  notification_date: string;
  status: NotificationStatus;
}

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface DbInternshipProgress {
  progress_id: string;
  student_id: string;
  completed_hours: number;
  remaining_hours: number;
  progress_status: ProgressStatus;
  updated_at: string;
}

export interface DbAnnouncement {
  announcement_id: string;
  author_user_id: string | null;
  title: string;
  content: string;
  target_role: string;
  target_department: string;
  created_at: string;
}
