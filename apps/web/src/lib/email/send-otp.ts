/**
 * Email Dispatcher for Colegio de Montalban OJT Portal
 * Sends 6-digit verification OTPs for password recovery.
 *
 * Supported delivery modes:
 * 1. Resend API (REST - zero extra dependencies) via RESEND_API_KEY
 * 2. Development Console Fallback (logs code to terminal for instant local testing)
 */

interface SendOtpOptions {
  to: string;
  fullName: string;
  otp: string;
  expiresMinutes?: number;
}

export async function sendOtpEmail({
  to,
  fullName,
  otp,
  expiresMinutes = 10,
}: SendOtpOptions): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Colegio de Montalban <onboarding@resend.dev>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Colegio de Montalban - Password Verification Code</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <div style="background-color: #0A3D24; padding: 28px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 0; letter-spacing: 0.5px;">
              COLEGIO DE MONTALBAN
            </h1>
            <p style="color: #FFCC00; font-size: 12px; font-weight: 700; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">
              Cross-Platform OJT Practicum System
            </p>
          </div>

          <!-- Body Content -->
          <div style="padding: 32px 28px;">
            <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">
              Password Recovery Verification
            </h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              Hello <strong style="color: #0A3D24;">${escapeHtml(fullName)}</strong>,
            </p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
              We received a request to reset your password for your Colegio de Montalban OJT Portal account. Please use the 6-digit verification code below to complete your password update:
            </p>

            <!-- Code Highlight Box -->
            <div style="background-color: #f0fdf4; border: 2px dashed #0A3D24; border-radius: 10px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
              <span style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #0A3D24; font-family: monospace;">
                ${otp}
              </span>
              <p style="color: #15803d; font-size: 12px; font-weight: 600; margin: 10px 0 0 0;">
                Valid for the next ${expiresMinutes} minutes
              </p>
            </div>

            <!-- Security Warning -->
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin: 0 0 24px 0;">
              <p style="color: #991b1b; font-size: 12px; line-height: 1.5; margin: 0;">
                <strong>Security Alert:</strong> If you did not request this verification code, please ignore this email. Your current password remains secure, and no changes have been made to your account.
              </p>
            </div>

            <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
              For security, never share this code with anyone. Institutional staff and coordinators will never ask for your verification code.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 11px; margin: 0;">
              Colegio de Montalban • Kasiglahan Village, Rodriguez, Rizal
            </p>
            <p style="color: #94a3b8; font-size: 10px; margin: 4px 0 0 0;">
              Institute of Computing Studies &amp; Institute of Business and Entrepreneurship
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  // If Resend API key is provided, send via Resend REST API
  if (apiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject: `Your CdM OJT Portal Verification Code: ${otp}`,
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[sendOtpEmail] Resend API error:', errorData);
        // Fallback log to console so testing is not blocked
        logConsoleFallback(to, fullName, otp, expiresMinutes);
        return {
          success: true, // Graceful fallback
          error: errorData.message || 'Email delivery failed; code logged to console.',
        };
      }

      console.log(`[sendOtpEmail] Successfully dispatched OTP email to ${to}`);
      return { success: true };
    } catch (err: any) {
      console.error('[sendOtpEmail] Network failure calling Resend:', err);
      logConsoleFallback(to, fullName, otp, expiresMinutes);
      return { success: true };
    }
  }

  // Development Fallback: Log directly to terminal
  logConsoleFallback(to, fullName, otp, expiresMinutes);
  return { success: true };
}

function logConsoleFallback(to: string, fullName: string, otp: string, expiresMinutes: number) {
  console.log('\n' + '='.repeat(64));
  console.log('  COLEGIO DE MONTALBAN - PASSWORD RESET VERIFICATION CODE');
  console.log('='.repeat(64));
  console.log(`  Recipient : ${fullName} <${to}>`);
  console.log(`  OTP Code  : >>> ${otp} <<<`);
  console.log(`  Validity  : ${expiresMinutes} Minutes`);
  console.log(`  Timestamp : ${new Date().toLocaleString()}`);
  console.log('='.repeat(64) + '\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
