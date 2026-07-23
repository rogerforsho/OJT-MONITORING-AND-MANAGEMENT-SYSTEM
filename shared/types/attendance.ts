export interface DbWorkSchedule {
  schedule_id: string;
  company_id: string;
  day_of_week: number;
  time_in_start: string;
  time_in_cutoff: string;
  time_out: string;
  created_at: string;
}

export interface DbQrToken {
  token_id: string;
  token: string;
  company_id: string;
  issued_at: string;
  expires_at: string;
  used: boolean;
}

export interface OfflineAttendanceEvent {
  type: 'time_in' | 'time_out';
  student_id: string;
  assignment_id: string;
  attendance_date: string;
  captured_at: string;
  selfie_local_path: string;
  qr_token?: string;
  attendance_id?: string; // set for time_out to reference existing record
}
