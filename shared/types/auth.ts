export interface RegisterStudentInput {
  full_name: string;
  email: string;
  password: string;
  student_number: string;
  course: string;
  year_level: number;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthUser {
  user_id: string;
  email: string;
  full_name: string;
  role: import('./roles').UserRole;
  account_status: import('./roles').AccountStatus;
}
