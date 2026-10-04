const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function load(relative, mocks = {}, env = {}, globals = {}) {
  const filename = path.resolve(root, relative);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports, Buffer, File, FormData, Date, URL, process: { env },
    console: globals.console || console,
    fetch: globals.fetch || fetch,
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === '@/src/lib/uploadValidation')
        return load('apps/web/src/lib/uploadValidation.ts');
      return require(name);
    },
  }, { filename });
  return exports;
}

function file(name, type, bytes) {
  return new File([bytes], name, { type });
}

test('upload validation checks size, extension, MIME and actual bytes', async () => {
  const { validateUploadedFile } = load('apps/web/src/lib/uploadValidation.ts');
  const pdf = file('report.pdf', 'application/pdf', Buffer.from('%PDF-1.7\nexample'));
  assert.equal((await validateUploadedFile(pdf, ['.pdf'], 1024)).error, null);
  assert.equal((await validateUploadedFile(pdf, ['.pdf'], 4)).error.code, 'VALIDATION_FAILURE');
  assert.equal((await validateUploadedFile(file('report.exe', 'application/pdf', Buffer.from('%PDF-1.7')), ['.pdf'], 1024)).error.code, 'VALIDATION_FAILURE');
  assert.equal((await validateUploadedFile(file('report.pdf', 'application/pdf', Buffer.from('MZ malicious')), ['.pdf'], 1024)).error.code, 'VALIDATION_FAILURE');
  assert.equal((await validateUploadedFile(file('report.pdf', 'image/png', Buffer.from('%PDF-1.7')), ['.pdf'], 1024)).error.code, 'VALIDATION_FAILURE');
});

test('OTP delivery never prints the code and fails closed without email configuration', async () => {
  const logs = [];
  const email = load('apps/web/src/lib/email/send-otp.ts', {}, {}, {
    console: { log: (...parts) => logs.push(parts.join(' ')), error: (...parts) => logs.push(parts.join(' ')) },
  });
  const result = await email.sendOtpEmail({ to: 'student@example.test', fullName: 'Student', otp: '123456' });
  assert.equal(result.success, false);
  assert.equal(logs.some(line => line.includes('123456')), false);
});

test('OTP provider rejection is not treated as successful delivery', async () => {
  const logs = [];
  const email = load('apps/web/src/lib/email/send-otp.ts', {}, { RESEND_API_KEY: 'test-key' }, {
    fetch: async () => ({ ok: false, status: 429 }),
    console: { log: (...parts) => logs.push(parts.join(' ')), error: (...parts) => logs.push(parts.join(' ')) },
  });
  const result = await email.sendOtpEmail({ to: 'student@example.test', fullName: 'Student', otp: '123456' });
  assert.equal(result.success, false);
  assert.equal(logs.some(line => line.includes('123456')), false);
});

function signedDocumentFixture(pathVisible, studentOwner = 'student-user') {
  let signed = 0;
  const supabase = {
    auth: { async getUser() { return { data: { user: { id: 'reviewer' } } }; } },
    from(table) {
      const q = { select() { return this; }, eq() { return this; }, limit() { return this; },
        async single() { return { data: table === 'users'
          ? { role: 'Supervisor', account_status: 'active' }
          : { user_id: studentOwner, student_id: 'student-id' } }; },
        async maybeSingle() { return { data: pathVisible ? { student_id: 'student-id' } : null, error: null }; },
      }; return q;
    },
  };
  const service = { storage: { from() { return { async createSignedUrl() {
    signed++; return { data: { signedUrl: 'https://signed.example.test/document' }, error: null };
  } }; } } };
  const storage = load('apps/web/src/services/storage.ts', {
    '@/src/lib/supabase/server': { createClient: async () => supabase },
    '@/src/lib/supabase/service': { getServiceClient: () => service },
  });
  return { storage, get signed() { return signed; } };
}

test('signed document requires a visible report and a matching student folder', async () => {
  const denied = signedDocumentFixture(false);
  assert.equal((await denied.storage.getSignedDocumentUrl('student-user/report.pdf')).error.code, 'FORBIDDEN');
  assert.equal(denied.signed, 0);
  const wrongOwner = signedDocumentFixture(true);
  assert.equal((await wrongOwner.storage.getSignedDocumentUrl('another-user/report.pdf')).error.code, 'FORBIDDEN');
  assert.equal(wrongOwner.signed, 0);
  const allowed = signedDocumentFixture(true);
  assert.equal((await allowed.storage.getSignedDocumentUrl('student-user/report.pdf')).error, null);
  assert.equal(allowed.signed, 1);
});

test('OTP reset updates Auth only after a valid database claim', async () => {
  let status = 'invalid';
  let updates = 0;
  let claims = 0;
  const service = {
    async rpc(name) {
      if (name === 'claim_auth_rate_limit') return { data: true, error: null };
      claims++;
      return { data: [{ result_status: status, reset_user_id: status === 'valid' ? 'user-1' : null }], error: null };
    },
    auth: { admin: { async updateUserById() { updates++; return { error: null }; } } },
  };
  const auth = load('apps/web/src/services/auth.ts', {
    '@/src/lib/supabase/server': { createClient: async () => ({}) },
    '@/src/lib/supabase/service': { getServiceClient: () => service },
    '@/src/lib/email/send-otp': { sendOtpEmail: async () => ({ success: true }) },
    '@/src/lib/email/send-account-status': { sendAccountStatusEmail: async () => ({ success: true }) },
    '@/src/lib/departments': { isICSCourse: () => true, isIBECourse: () => false },
    './audit': { recordAuditEvent: async () => {} },
    'next/navigation': { redirect() {} },
  }, { SUPABASE_SERVICE_ROLE_KEY: 'test-service-secret' });
  assert.equal((await auth.verifyOtpAndResetPassword('a@example.test', '123456', 'password123')).error.code, 'VALIDATION_FAILURE');
  assert.equal(updates, 0);
  status = 'valid';
  assert.equal((await auth.verifyOtpAndResetPassword('a@example.test', '123456', 'password123')).error, null);
  assert.equal(updates, 1);
  assert.equal(claims, 2);
});

test('rate-limited OTP requests never attempt a password update', async () => {
  let updates = 0;
  const service = {
    async rpc(name) {
      assert.equal(name, 'claim_auth_rate_limit');
      return { data: false, error: null };
    },
    auth: { admin: { async updateUserById() { updates++; return { error: null }; } } },
  };
  const auth = load('apps/web/src/services/auth.ts', {
    '@/src/lib/supabase/server': { createClient: async () => ({}) },
    '@/src/lib/supabase/service': { getServiceClient: () => service },
    '@/src/lib/email/send-otp': { sendOtpEmail: async () => ({ success: true }) },
    '@/src/lib/email/send-account-status': { sendAccountStatusEmail: async () => ({ success: true }) },
    '@/src/lib/departments': { isICSCourse: () => true, isIBECourse: () => false },
    './audit': { recordAuditEvent: async () => {} },
    'next/navigation': { redirect() {} },
  }, { SUPABASE_SERVICE_ROLE_KEY: 'test-service-secret' });
  const result = await auth.verifyOtpAndResetPassword('a@example.test', '123456', 'password123');
  assert.equal(result.error.code, 'RATE_LIMITED');
  assert.equal(updates, 0);
});

test('supervisor onboarding generates an unknown password and emails only setup details', async () => {
  let createdPassword = '';
  let emailed;
  let deleted = 0;
  const service = {
    auth: { admin: {
      async createUser(input) { createdPassword = input.password; return { data: { user: { id: 'supervisor-1' } }, error: null }; },
      async deleteUser() { deleted++; return { error: null }; },
    } },
    from(table) {
      return {
        insert() { return Promise.resolve({ error: null }); },
        update() { return this; },
        eq() { return table === 'users' ? Promise.resolve({ error: null }) : this; },
        select() { return this; },
        async single() { return { data: { company_name: 'Test Company' } }; },
      };
    },
  };
  const supabase = {
    auth: { async getUser() { return { data: { user: { id: 'coordinator-1' } } }; } },
    from() { return { select() { return this; }, eq() { return this; },
      async single() { return { data: { role: 'Coordinator', account_status: 'active' } }; } }; },
  };
  const supervisors = load('apps/web/src/services/supervisors.ts', {
    '@/src/lib/supabase/server': { createClient: async () => supabase },
    '@/src/lib/supabase/service': { getServiceClient: () => service },
    '@/src/lib/email/send-account-status': { async sendSupervisorWelcomeEmail(input) { emailed = input; return { success: true }; } },
  });
  const result = await supervisors.createSupervisor({
    full_name: 'Test Supervisor', email: 'supervisor@example.test',
    company_id: 'company-1', position: 'Mentor',
  });
  assert.equal(result.error, null);
  assert.ok(createdPassword.length >= 32);
  assert.ok(emailed.employeeNumber.startsWith('SUP-'));
  assert.equal(Object.hasOwn(emailed, 'temporaryPassword'), false);
  assert.equal(deleted, 0);
});

test('supervisor onboarding rolls back an account when welcome email fails', async () => {
  let deletedId = '';
  const service = {
    auth: { admin: {
      async createUser() { return { data: { user: { id: 'supervisor-2' } }, error: null }; },
      async deleteUser(id) { deletedId = id; return { error: null }; },
    } },
    from(table) {
      return {
        insert() { return Promise.resolve({ error: null }); },
        update() { return this; },
        eq() { return table === 'users' ? Promise.resolve({ error: null }) : this; },
        select() { return this; },
        async single() { return { data: { company_name: 'Test Company' } }; },
      };
    },
  };
  const supabase = {
    auth: { async getUser() { return { data: { user: { id: 'coordinator-1' } } }; } },
    from() { return { select() { return this; }, eq() { return this; },
      async single() { return { data: { role: 'Coordinator', account_status: 'active' } }; } }; },
  };
  const supervisors = load('apps/web/src/services/supervisors.ts', {
    '@/src/lib/supabase/server': { createClient: async () => supabase },
    '@/src/lib/supabase/service': { getServiceClient: () => service },
    '@/src/lib/email/send-account-status': { async sendSupervisorWelcomeEmail() { return { success: false }; } },
  });
  const result = await supervisors.createSupervisor({
    full_name: 'Test Supervisor', email: 'supervisor@example.test',
    company_id: 'company-1', position: 'Mentor',
  });
  assert.equal(result.error.code, 'SERVER_FAILURE');
  assert.equal(deletedId, 'supervisor-2');
});

test('audit listing reports a database failure instead of showing an empty log', async () => {
  const supabase = {
    auth: { async getUser() { return { data: { user: { id: 'admin-1' } } }; } },
    from() { return { select() { return this; }, eq() { return this; },
      async single() { return { data: { role: 'Admin', account_status: 'active' } }; } }; },
  };
  const service = { from() { return {
    select() { return this; }, order() { return this; },
    async range() { return { data: null, error: { message: 'database unavailable' } }; },
  }; } };
  const logs = [];
  const audit = load('apps/web/src/services/audit.ts', {
    '@/src/lib/supabase/server': { createClient: async () => supabase },
    '@/src/lib/supabase/service': { getServiceClient: () => service },
  }, {}, { console: { error: (...parts) => logs.push(parts.join(' ')) } });
  const result = await audit.listAuditLogs();
  assert.equal(result.error.code, 'SERVER_FAILURE');
  assert.equal(result.data, null);
  assert.ok(logs.some(line => line.includes('database unavailable')));
});
