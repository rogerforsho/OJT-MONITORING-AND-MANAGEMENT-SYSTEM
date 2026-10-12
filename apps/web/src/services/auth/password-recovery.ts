import 'server-only';
import crypto from 'crypto';
import { serviceClient, authActionLimit } from './internal';
import { sendOtpEmail } from '@/src/lib/email/send-otp';
import { recordAuditEvent } from '@/src/lib/audit';
import type { AppResult } from '@ojt/shared';
function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) return `${name[0]}*@${domain}`;
  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 5))}${name[name.length - 1]}@${domain}`;
}

export async function requestPasswordReset(
  email: string,
  identifier?: string,
  expectedRole?: 'Student' | 'Staff'
): Promise<AppResult<{ email: string; maskedEmail: string; expiresAt: string }>> {
  if (!email?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Email address is required.' } };

  const limitError = await authActionLimit('password_reset_request', email, 3, 900);
  if (limitError) return { data: null, error: limitError };

  const service = serviceClient();
  const normalizedEmail = email.trim().toLowerCase();

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const accepted = { data: { email: normalizedEmail, maskedEmail: maskEmail(normalizedEmail), expiresAt }, error: null };
  const { data: userProfile, error: queryError } = await service.from('users')
    .select('user_id, role, full_name, employee_number').eq('email', normalizedEmail).maybeSingle();
  if (queryError) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Account recovery is temporarily unavailable. Please try again later.' } };
  // Same public response for missing accounts, role mismatch and ID mismatch.
  if (!userProfile || (expectedRole === 'Student' && userProfile.role !== 'Student') ||
      (expectedRole === 'Staff' && userProfile.role === 'Student')) return accepted;
  const inputId = typeof identifier === 'string' ? identifier.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  let storedId = userProfile.employee_number || '';
  if (userProfile.role === 'Student') {
    const { data: student, error } = await service.from('students').select('student_number').eq('user_id', userProfile.user_id).maybeSingle();
    if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Account recovery is temporarily unavailable. Please try again later.' } };
    storedId = student?.student_number || '';
  }
  if (!inputId || inputId !== storedId.toLowerCase().replace(/[^a-z0-9]/g, '')) return accepted;

  // 4. Generate cryptographically secure 6-digit numeric OTP
  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');


  // Invalidate any existing unused OTPs for this email address
  await service
    .from('password_reset_otps')
    .update({ used: true })
    .eq('email', normalizedEmail)
    .eq('used', false);

  // Insert new hashed OTP record
  const { error: insertErr } = await service.from('password_reset_otps').insert({
    user_id: userProfile.user_id,
    email: normalizedEmail,
    otp_hash: otpHash,
    expires_at: expiresAt,
    attempts: 0,
    used: false,
  });

  if (insertErr) {
    console.error('[requestPasswordReset] OTP persistence failed');
    return {
      data: null,
      error: { code: 'SERVER_FAILURE', message: 'Failed to issue verification code. Please try again.' },
    };
  }

  // 5. Dispatch branded email with 6-digit verification code
  const delivery = await sendOtpEmail({
    to: normalizedEmail,
    fullName: userProfile.full_name || 'Colegio de Montalban User',
    otp,
    expiresMinutes: 10,
  });
  if (!delivery.success) {
    await service.from('password_reset_otps').update({ used: true }).eq('email', normalizedEmail).eq('used', false);
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Unable to deliver a reset code. Please try again later.' } };
  }

  return {
    data: {
      email: normalizedEmail,
      maskedEmail: maskEmail(normalizedEmail),
      expiresAt,
    },
    error: null,
  };
}

export async function verifyOtpAndResetPassword(
  email: string,
  otp: string,
  newPassword: string
): Promise<AppResult<{ success: boolean }>> {
  if (!email?.trim() || !otp?.trim() || !newPassword) {
    return {
      data: null,
      error: { code: 'VALIDATION_FAILURE', message: 'Email, verification code, and new password are required.' },
    };
  }

  if (newPassword.length < 8) {
    return {
      data: null,
      error: { code: 'VALIDATION_FAILURE', message: 'Password must be at least 8 characters long.' },
    };
  }

  const cleanOtp = otp.trim().replace(/\D/g, '');
  if (cleanOtp.length !== 6) {
    return {
      data: null,
      error: { code: 'VALIDATION_FAILURE', message: 'Verification code must be exactly 6 digits.' },
    };
  }

  const limitError = await authActionLimit('password_reset_verify', email, 10, 900);
  if (limitError) return { data: null, error: limitError };

  const service = serviceClient();
  const normalizedEmail = email.trim().toLowerCase();

  // A database row lock ensures only one caller can consume a valid code.
  const otpHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
  const { data: claim, error: claimError } = await service.rpc('consume_password_reset_otp', {
    p_email: normalizedEmail, p_otp_hash: otpHash,
  });
  if (claimError) {
    console.error('[verifyOtpAndResetPassword] OTP claim failed');
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Password reset is temporarily unavailable.' } };
  }
  const result = claim?.[0];
  if (result?.result_status !== 'valid' || !result.reset_user_id) {
    const message = result?.result_status === 'expired'
      ? 'The verification code has expired. Please request a new code.'
      : 'Invalid or already used verification code. Please request a new code if needed.';
    return { data: null, error: { code: 'VALIDATION_FAILURE', message } };
  }

  const { error: adminAuthErr } = await service.auth.admin.updateUserById(result.reset_user_id, {
    password: newPassword,
  });
  if (adminAuthErr) {
    console.error('[verifyOtpAndResetPassword] Auth password update failed');
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Password update failed. Request a new code and try again.' } };
  }

  await recordAuditEvent({
    actor_user_id: result.reset_user_id,
    action: 'PASSWORD_RESET_VIA_OTP', entity_type: 'user', entity_id: result.reset_user_id,
    details: { reset_method: '6_DIGIT_OTP' },
  });

  return { data: { success: true }, error: null };
}
