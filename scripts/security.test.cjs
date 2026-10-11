const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

// A small stateful database double: assertions below inspect resulting records,
// not just whether a particular query-builder method was called.
function workflowFixture(role = 'Admin', options = {}) {
  const tables = { users: [{ user_id: 'actor', role, account_status: options.status || 'active' }], ...options.tables };
  const events = [];
  const writes = [];
  let serviceCalls = 0;
  let emailCount = 0;
  let deleted = 0;
  const field = (row, key) => key.split('.').reduce((value, part) => {
    const fieldName = part === 'progress_filter' ? 'internship_progress' : part;
    return value?.[fieldName];
  }, row);
  function from(table) {
    let op = 'select', values, head = false, start = 0, end = Infinity;
    const filters = [];
    function execute(single = false) {
      const error = options.fail?.(table, op);
      if (error) return { data: null, error: { message: error }, count: null };
      if (op === 'update') options.beforeUpdate?.(table, tables);
      let rows = (tables[table] || []).filter(row => filters.every(test => test(row)));
      if (op === 'update') { rows.forEach(row => Object.assign(row, values)); writes.push({ table, op, count: rows.length }); }
      if (op === 'upsert' || op === 'insert') {
        rows = [];
        for (const input of Array.isArray(values) ? values : [values]) {
          const existing = op === 'upsert' && input.user_id && (tables[table] || []).find(row => row.user_id === input.user_id);
          if (existing) { Object.assign(existing, input); rows.push(existing); }
          else { const row = { ...input }; (tables[table] ||= []).push(row); rows.push(row); }
        }
        writes.push({ table, op, count: rows.length });
      }
      const count = rows.length;
      rows = rows.slice(start, end + 1).map(row => ({ ...row }));
      return { data: head ? null : single ? rows[0] || null : rows, count, error: null };
    }
    return {
      select(_columns, config) { head = config?.head || false; return this; },
      eq(key, value) { filters.push(row => field(row, key) === value); return this; },
      in(key, values) { filters.push(row => values.includes(field(row, key))); return this; },
      not(key, operator, value) {
        if (operator === 'is' && value === 'null') filters.push(row => field(row, key) != null);
        else if (operator === 'ilike') filters.push(row => !String(field(row, key) || '').toUpperCase().includes(value.replaceAll('%', '').toUpperCase()));
        else throw new Error('Unsupported mock not filter: ' + operator);
        return this;
      },
      or(expression) {
        const terms = expression.split(',');
        filters.push(row => terms.some(term => {
          const isNull = /^(.+)\.is\.null$/.exec(term);
          if (isNull) return field(row, isNull[1]) == null;
          const equals = /^(.+)\.eq\.(.+)$/.exec(term);
          if (equals) return String(field(row, equals[1])) === equals[2];
          const ilike = /^(.+)\.ilike\.(.*)$/.exec(term);
          if (ilike) return String(field(row, ilike[1]) || '').toUpperCase().includes(ilike[2].replaceAll('*', '').toUpperCase());
          const notNull = /^(.+)\.not\.is\.null$/.exec(term);
          if (notNull) return field(row, notNull[1]) != null;
          throw new Error('Unsupported mock OR filter: ' + term);
        }));
        return this;
      },
      order() { return this; },
      range(first, last) { start = first; end = last; return this; },
      limit(value) { end = value - 1; return this; },
      update(value) { op = 'update'; values = value; return this; },
      upsert(value) { op = 'upsert'; values = value; return this; },
      insert(value) { op = 'insert'; values = value; return this; },
      async single() { return execute(true); },
      async maybeSingle() { return execute(true); },
      then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
    };
  }
  const client = { from, auth: { async getUser() { return { data: { user: role ? { id: 'actor' } : null } }; }, async signUp() { return options.signupResponse || { data: { user: { id: 'new-student', identities: [{ provider: 'email' }] }, session: null }, error: null }; }, async signOut() { return { error: null }; } } };
  const service = { from, async rpc() { return { data: true, error: null }; }, auth: { admin: {
    async getUserById(id) { return { data: { user: { id, email_confirmed_at: options.unconfirmedUsers?.includes(id) ? null : '2026-01-01T00:00:00Z' } }, error: null }; },
    async createUser(input) {
      tables.users.push({ user_id: 'new-user', role: input.app_metadata.role, account_status: 'pending' });
      return { data: { user: { id: 'new-user' } }, error: null };
    },
    async deleteUser(id) { deleted++; tables.users = tables.users.filter(row => row.user_id !== id); return { error: null }; },
  } } };
  const modules = {};
  function module(name) {
    return modules[name] ||= load(`apps/web/src/services/${name}.ts`, {
      '@/src/lib/supabase/server': { createClient: async () => client },
      '@/src/lib/supabase/service': { getServiceClient: () => { serviceCalls++; return service; } },
      '@/src/lib/supabase/public-url': load('apps/web/src/lib/supabase/public-url.ts'),
      '@/src/lib/departments': load('apps/web/src/lib/departments.ts'),
      '@/src/lib/department-scope': load('apps/web/src/lib/department-scope.ts', { 'server-only': {} }),
      '@/src/lib/email/send-otp': { sendOtpEmail: async () => ({ success: true }) },
      '@/src/lib/email/send-account-status': { sendAccountStatusEmail: async () => { emailCount++; return { success: true }; } },
      '@/src/lib/audit': { recordAuditEvent: async input => { events.push(input); } },
      './reports': { checkStudentGatewayStatus: async () => ({ isCleared: true, approvedCount: 5, missing: [] }) },
      '@ojt/shared': load('shared/gateway.ts'),
      'next/navigation': { redirect() {} },
    }, { NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'unit-test-hmac-key', NEXT_PUBLIC_APP_URL: 'https://portal.test' });
  }
  return { tables, writes, events, module, client, service, get deleted() { return deleted; }, get emailCount() { return emailCount; }, get serviceCalls() { return serviceCalls; } };
}

const attendanceId = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;

test('cohort progress status filters run before pagination and count matching students', async () => {
  const fixture = workflowFixture('Coordinator', { tables: { students: [
    { student_id: 'zero', student_number: '001', course: 'BSIT', users: { account_status: 'active', full_name: 'Zero' }, internship_progress: null },
    { student_id: 'new', student_number: '002', course: 'BSIT', users: { account_status: 'active', full_name: 'New' }, internship_progress: { completed_hours: 0, progress_status: 'not_started' } },
    { student_id: 'active', student_number: '003', course: 'BSIT', users: { account_status: 'active', full_name: 'Active' }, internship_progress: { completed_hours: 12, progress_status: 'in_progress' } },
    { student_id: 'done', student_number: '004', course: 'BSIT', users: { account_status: 'active', full_name: 'Done' }, internship_progress: { completed_hours: 486, progress_status: 'completed' } },
  ] } });
  const service = fixture.module('progress');
  const active = await service.listCohortProgress(1, 1, 'all', 'in_progress');
  assert.equal(active.data.total, 1);
  assert.equal(active.data.students[0].student_id, 'active');
  const notStarted = await service.listCohortProgress(1, 1, 'all', 'not_started');
  assert.equal(notStarted.data.total, 2);
  assert.equal(notStarted.data.students[0].student_id, 'zero');
  assert.equal((await service.listCohortProgress(1, 20, 'all', 'unexpected')).error.code, 'VALIDATION_FAILURE');
});

test('Program Heads see only their stored department in paginated progress, totals, and clearance', async () => {
  for (const department of ['ICS', 'IBE']) {
    const fixture = workflowFixture('ProgramHead', { tables: {
      program_heads: [{ user_id: 'actor', department_or_program: department }],
      students: Array.from({ length: 450 }, (_, index) => ({ student_id: `s${index}`, course: index % 2 ? 'BSENTREP' : 'BSIT', users: { account_status: 'active', full_name: `Student ${index}` }, internship_progress: { completed_hours: 2, progress_status: 'in_progress' } })),
    } });
    const progress = fixture.module('progress');
    const page = await progress.listCohortProgress(2, 200);
    assert.equal(page.error, null);
    assert.equal(page.data.total, 225);
    assert.equal(page.data.students.length, 25);
    assert.equal(page.data.students.every(row => row.course === (department === 'ICS' ? 'BSIT' : 'BSENTREP')), true);
    const conflicting = await progress.listCohortProgress(1, 20, department === 'ICS' ? 'BSENTREP' : 'BSIT');
    assert.equal(conflicting.data.total, 0);
    const summary = await progress.getDepartmentSummary();
    assert.equal(summary.data.totalStudents, 225);
    assert.equal(summary.data.totalRenderedHours, 450);
    assert.equal(summary.data[department === 'ICS' ? 'ibe' : 'ics'].total, 0);
    const denied = await fixture.module('certificates').checkClearanceStatus(department === 'ICS' ? 's1' : 's0');
    assert.equal(denied.error.code, 'FORBIDDEN');
  }
});

test('missing, unknown, or unavailable Program Head assignments fail closed before privileged reads', async () => {
  for (const department of [null, 'ALL', '']) {
    const fixture = workflowFixture('ProgramHead', { tables: { program_heads: department === null ? [] : [{ user_id: 'actor', department_or_program: department }] } });
    assert.equal((await fixture.module('progress').listCohortProgress()).error.code, 'FORBIDDEN');
    assert.equal((await fixture.module('progress').getDepartmentSummary()).error.code, 'FORBIDDEN');
    assert.equal((await fixture.module('certificates').checkClearanceStatus('student')).error.code, 'FORBIDDEN');
    assert.equal(fixture.serviceCalls, 0);
  }
  const fixture = workflowFixture('ProgramHead', { fail: table => table === 'program_heads' ? 'offline' : null });
  assert.equal((await fixture.module('progress').getDepartmentSummary()).error.code, 'FORBIDDEN');
  assert.equal(fixture.serviceCalls, 0);
});

test('cohort pagination rejects invalid bounds and summaries do not truncate after 200 records', async () => {
  const fixture = workflowFixture('Coordinator', { tables: { students: Array.from({ length: 401 }, (_, i) => ({ student_id: `s${i}`, course: 'BSIT', users: { account_status: 'active' } })) } });
  for (const [page, size] of [[0, 20], [1, 0], [1, 201], [NaN, 20], [1.5, 20]]) {
    assert.equal((await fixture.module('progress').listCohortProgress(page, size)).error.code, 'VALIDATION_FAILURE');
  }
  assert.equal((await fixture.module('progress').getDepartmentSummary()).data.totalStudents, 401);
});

test('certificate issuance cannot bypass unmet clearance requirements', async () => {
  const fixture = workflowFixture('Coordinator', { tables: { students: [{ student_id: 'student', course: 'BSIT', required_hours: 486, users: { full_name: 'Student' } }] } });
  const result = await fixture.module('certificates').issueCertificate('student');
  assert.equal(result.error.code, 'VALIDATION_FAILURE');
  assert.equal(fixture.writes.length, 0);
  assert.equal(fixture.events.length, 0);
});

test('department report loads the complete cohort and rejects incomplete results instead of exporting a partial report', async () => {
  const fixture = workflowFixture('ProgramHead', { tables: {
    program_heads: [{ user_id: 'actor', department_or_program: 'ICS' }],
    students: Array.from({ length: 401 }, (_, i) => ({ student_id: `s${i}`, course: 'BSIT', users: { account_status: 'active' } })),
  } });
  const service = fixture.module('progress');
  const mocks = {
    'next/navigation': { redirect() { throw new Error('Unexpected redirect'); } },
    '@/src/lib/supabase/server': { createClient: async () => fixture.client },
    '@/src/lib/supabase/service': { getServiceClient: () => fixture.service },
    '@/src/services/progress': service,
    './DepartmentReportsClient': () => null,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
  };
  const file = 'apps/web/app/(dashboard)/program-head/reports/page.tsx';
  const rendered = await load(file, mocks).default();
  assert.equal(rendered.props.initialStudents.length, 401);
  assert.equal(new Set(rendered.props.initialStudents.map(s => s.student_id)).size, 401);
  assert.equal(rendered.props.summary.totalStudents, 401);
  mocks['@/src/services/progress'] = { ...service, listCohortProgress: async (page, size) => page === 2 ? { data: null, error: { message: 'offline' } } : service.listCohortProgress(page, size) };
  await assert.rejects(() => load(file, mocks).default(), /fully loaded/);
});

test('Program Head approvals, grading, assignments, and schedule reviews reject other departments before writes', async () => {
  for (const department of ['ICS', 'IBE']) {
    const fixture = workflowFixture('ProgramHead', { tables: {
      program_heads: [{ user_id: 'actor', department_or_program: department }],
      students: [{ student_id: 'foreign', user_id: 'foreign-user', course: department === 'ICS' ? 'BSENTREP' : 'BSIT' }],
      reports: [{ report_id: 'report', student_id: 'foreign', status: 'submitted' }],
      evaluations: [{ evaluation_id: 'evaluation', student_id: 'foreign', performance_score: 60 }],
      student_assignments: [{ assignment_id: 'assignment', student_id: 'foreign', assignment_status: 'active' }],
      practicum_schedules: [{ schedule_id: 'schedule', student_id: 'foreign', status: 'pending' }],
    } });
    const calls = [
      ['auth', 'updateStudentAccountStatus', ['foreign-user', 'active']],
      ['reports', 'reviewReport', ['report', 'approved']],
      ['reports', 'sendRequirementReminder', ['foreign-user', ['Report']]],
      ['evaluations', 'overrideEvaluation', ['evaluation', 90, 'Review']],
      ['assignments', 'createAssignment', [{ student_id: 'foreign', company_id: 'company', supervisor_id: 'supervisor', start_date: '2026-10-06' }]],
      ['assignments', 'updateAssignmentStatus', ['assignment', 'completed']],
      ['assignments', 'updateStudentStatus', ['foreign', 'completed']],
      ['assignments', 'reassignStudent', ['foreign', 'company', 'supervisor', '2026-10-06']],
      ['schedule', 'reviewPracticumSchedule', ['schedule', 'approve']],
    ];
    for (const [module, method, args] of calls) {
      assert.equal((await fixture.module(module)[method](...args)).error.code, 'FORBIDDEN', `${department} ${method}`);
    }
    assert.equal(fixture.writes.length, 0);
    assert.equal(fixture.events.length, 0);
    assert.equal(fixture.serviceCalls, 0);
  }
});

test('Program Heads can approve, assign, and grade their own department', async () => {
  for (const department of ['ICS', 'IBE']) {
    const fixture = workflowFixture('ProgramHead', { tables: {
      users: [{ user_id: 'actor', role: 'ProgramHead', account_status: 'active' }, { user_id: 'student-user', role: 'Student', account_status: 'pending', full_name: 'Student', email: 'student@example.test' }],
      program_heads: [{ user_id: 'actor', department_or_program: department }],
      students: [{ student_id: 'own', user_id: 'student-user', course: department === 'ICS' ? 'BSIT' : 'BSENTREP' }],
      reports: [{ report_id: 'report', student_id: 'own', status: 'submitted' }],
      evaluations: [{ evaluation_id: 'evaluation', student_id: 'own', performance_score: 60 }],
      supervisors: [{ supervisor_id: 'supervisor', company_id: 'company' }],
      practicum_schedules: [{ schedule_id: 'schedule', student_id: 'own', status: 'pending' }],
    } });
    assert.equal((await fixture.module('auth').updateStudentAccountStatus('student-user', 'active')).error, null);
    assert.equal((await fixture.module('reports').reviewReport('report', 'approved')).error, null);
    assert.equal((await fixture.module('evaluations').overrideEvaluation('evaluation', 90, 'Review')).error, null);
    assert.equal((await fixture.module('assignments').createAssignment({ student_id: 'own', company_id: 'company', supervisor_id: 'supervisor', start_date: '2026-10-06' })).error, null);
    assert.equal((await fixture.module('schedule').reviewPracticumSchedule('schedule', 'approve')).error, null);
    assert.equal(fixture.tables.users[1].account_status, 'active');
    assert.equal(fixture.tables.reports[0].status, 'approved');
    assert.equal(fixture.tables.evaluations[0].performance_score, 90);
    assert.equal(fixture.tables.student_assignments[0].student_id, 'own');
    assert.equal(fixture.tables.practicum_schedules[0].status, 'approved');
  }
});

test('evaluation summaries deny cross-department and unassigned reads before service-role access', async () => {
  const head = workflowFixture('ProgramHead', { tables: {
    program_heads: [{ user_id: 'actor', department_or_program: 'ICS' }],
    students: [{ student_id: 'foreign', course: 'BSENTREP' }],
  } });
  assert.equal((await head.module('evaluations').getStudentEvaluationSummary('foreign')).error.code, 'FORBIDDEN');
  assert.equal(head.serviceCalls, 0);
  const supervisor = workflowFixture('Supervisor', { tables: {
    supervisors: [{ user_id: 'actor', supervisor_id: 'supervisor' }],
    student_assignments: [{ student_id: 'foreign', supervisor_id: 'other', assignment_status: 'active' }],
  } });
  assert.equal((await supervisor.module('evaluations').getStudentEvaluationSummary('foreign')).error.code, 'FORBIDDEN');
  assert.equal(supervisor.serviceCalls, 0);
  const own = workflowFixture('Student', { tables: { students: [{ user_id: 'actor', student_id: 'own', course: 'BSIT', users: { full_name: 'Self' } }] } });
  assert.equal((await own.module('evaluations').getStudentEvaluationSummary('foreign')).data.student_id, 'own');
});

test('installer downloads allow only known filenames and reject traversal before filesystem access', async () => {
  let probes = 0;
  const route = load('apps/web/app/downloads/[filename]/route.ts', { fs: {
    existsSync() { probes++; return true; },
    statSync() { return { size: 4, isFile: () => true }; },
    createReadStream() { return require('node:stream').Readable.from([Buffer.from('MZok')]); },
  } });
  for (const filename of ['nonexistent.exe', '../cdm.env', '../../secret.exe', 'cdm.txt']) {
    const result = await route.GET(new Request('http://localhost/downloads/test'), { params: Promise.resolve({ filename }) });
    assert.equal(result.status, 404);
  }
  assert.equal(probes, 0);
  const result = await route.GET(new Request('http://localhost/downloads/test'), { params: Promise.resolve({ filename: 'CdM-OJT-Portal-Setup-1.0.0.exe' }) });
  assert.equal(result.status, 200);
  assert.equal(await result.text(), 'MZok');
  assert.equal(result.headers.get('content-length'), '4');
});

test('clearance details require authentication and students can read only their own record', async () => {
  const anonymous = workflowFixture(null);
  assert.equal((await anonymous.module('certificates').checkClearanceStatus('student')).error.code, 'FORBIDDEN');
  assert.equal(anonymous.serviceCalls, 0);
  const fixture = workflowFixture('Student', { tables: { students: [
    { student_id: 'own', user_id: 'actor', student_number: '1', course: 'BSIT', users: { full_name: 'Self' } },
    { student_id: 'foreign', user_id: 'other', student_number: '2', course: 'BSIT', users: { full_name: 'Other' } },
  ] } });
  assert.equal((await fixture.module('certificates').checkClearanceStatus('foreign')).error.code, 'FORBIDDEN');
  assert.equal(fixture.serviceCalls, 0);
  const own = await fixture.module('certificates').checkClearanceStatus('own');
  assert.equal(own.error, null);
  assert.equal(own.data.student_name, 'Self');
});

test('evaluation rejects invalid numeric scores and out-of-range rubric entries before saving', async () => {
  const fixture = workflowFixture('Supervisor');
  for (const performance_score of [NaN, Infinity, -1, 101, '75']) {
    const result = await fixture.module('evaluations').createEvaluation({ student_id: 'student', feedback: 'Feedback', performance_score });
    assert.equal(result.error.code, 'VALIDATION_FAILURE');
  }
  const result = await fixture.module('evaluations').createEvaluation({ student_id: 'student', feedback: 'Feedback', performance_score: null,
    criteria: { technical_competence: 26, productivity_dependability: 20, attendance_punctuality: 20, communication_skills: 15, work_ethics_professionalism: 19 } });
  assert.equal(result.error.code, 'VALIDATION_FAILURE');
  assert.equal(fixture.writes.length, 0);
});

test('modal traps keyboard focus, closes on Escape, and restores focus and scroll state', () => {
  const refs = [], effects = [];
  let onKey, closed = 0;
  const doc = { body: { style: { overflow: 'auto' } },
    addEventListener(_type, handler) { onKey = handler; }, removeEventListener() { onKey = null; } };
  const element = () => ({ isConnected: true, getClientRects: () => [1], focus() { doc.activeElement = this; } });
  const trigger = element(), first = element(), last = element();
  doc.activeElement = trigger;
  const dialog = { ...element(), querySelectorAll: () => [first, last], contains: item => [first, last, dialog].includes(item) };
  const jsx = (type, props) => ({ type, props });
  const Modal = load('apps/web/src/components/ui/Modal.tsx', {
    react: { useEffect: fn => effects.push(fn), useRef: initial => { const ref = { current: initial }; refs.push(ref); return ref; }, useState: () => [true, () => {}], useId: () => 'dialog-title' },
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-dom': { createPortal: value => value },
  }, {}, { document: doc }).default;
  const output = Modal({ title: 'Confirm', open: true, onClose: () => closed++, children: 'Body' });
  refs[1].current = dialog;
  const cleanups = effects.map(effect => effect()).filter(Boolean);
  assert.equal(output.props.children.props.role, 'dialog');
  assert.equal(doc.activeElement, first);
  assert.equal(doc.body.style.overflow, 'hidden');
  last.focus();
  onKey({ key: 'Tab', shiftKey: false, preventDefault() {} });
  assert.equal(doc.activeElement, first);
  onKey({ key: 'Tab', shiftKey: true, preventDefault() {} });
  assert.equal(doc.activeElement, last);
  onKey({ key: 'Escape', preventDefault() {} });
  assert.equal(closed, 1);
  cleanups.forEach(cleanup => cleanup());
  assert.equal(doc.activeElement, trigger);
  assert.equal(doc.body.style.overflow, 'auto');
});

test('batch attendance verification changes only requested pending records assigned to the supervisor', async () => {
  const fixture = workflowFixture('Supervisor', { tables: {
    supervisors: [{ user_id: 'actor', supervisor_id: 'supervisor' }],
    student_assignments: [{ student_id: 'own-student', supervisor_id: 'supervisor', assignment_status: 'active' }],
    attendance: [
      { attendance_id: attendanceId(1), student_id: 'own-student', verification_status: 'pending' },
      { attendance_id: attendanceId(2), student_id: 'own-student', verification_status: 'pending' },
      { attendance_id: attendanceId(3), student_id: 'other-student', verification_status: 'pending' },
      { attendance_id: attendanceId(4), student_id: 'own-student', verification_status: 'rejected' },
    ],
  } });
  const result = await fixture.module('attendance').batchVerifyAttendance([attendanceId(1), attendanceId(3), attendanceId(4)]);
  assert.equal(result.data.verifiedCount, 1);
  assert.deepEqual(fixture.tables.attendance.map(row => row.verification_status), ['verified', 'pending', 'pending', 'rejected']);
  assert.equal(fixture.events.length, 1);
  assert.equal((await fixture.module('attendance').batchVerifyAttendance([])).error.code, 'VALIDATION_FAILURE');
  assert.equal((await fixture.module('attendance').batchVerifyAttendance(Array(21).fill(attendanceId(1)))).error.code, 'VALIDATION_FAILURE');
});

test('a concurrent attendance decision cannot be overwritten by a stale verification', async () => {
  const fixture = workflowFixture('Supervisor', { tables: {
    supervisors: [{ user_id: 'actor', supervisor_id: 'supervisor' }],
    student_assignments: [{ assignment_id: 'assignment', student_id: 'student', supervisor_id: 'supervisor', assignment_status: 'active' }],
    attendance: [{ attendance_id: attendanceId(1), student_id: 'student', verification_status: 'pending' }],
  }, beforeUpdate(table, tables) { if (table === 'attendance') tables.attendance[0].verification_status = 'rejected'; } });
  const result = await fixture.module('attendance').verifyAttendance(attendanceId(1), 'verified');
  assert.equal(result.error.code, 'DUPLICATE_REQUEST');
  assert.equal(fixture.tables.attendance[0].verification_status, 'rejected');
});

test('student approval cannot change staff accounts or overwrite an earlier decision', async () => {
  const fixture = workflowFixture('Coordinator');
  fixture.tables.users.push(
    { user_id: 'admin-target', role: 'Admin', account_status: 'pending' },
    { user_id: 'student-target', role: 'Student', account_status: 'pending', email: 'test@example.invalid' },
  );
  const auth = fixture.module('auth');
  assert.equal((await auth.updateStudentAccountStatus('admin-target', 'active')).error.code, 'NOT_FOUND');
  assert.equal(fixture.tables.users[1].account_status, 'pending');
  assert.equal((await auth.updateStudentAccountStatus('student-target', 'active')).error, null);
  assert.equal((await auth.updateStudentAccountStatus('student-target', 'rejected')).error.code, 'NOT_FOUND');
  assert.equal(fixture.tables.users[2].account_status, 'active');
  assert.equal(fixture.emailCount, 1);
  assert.equal((await auth.updateStudentAccountStatus('student-target', 'inactive')).error.code, 'VALIDATION_FAILURE');
});

test('duplicate Supabase signup identities are not deleted or persisted as new students', async () => {
  const fixture = workflowFixture(null, { signupResponse: { data: { user: { id: 'existing-user', identities: [] }, session: null }, error: null } });
  const result = await fixture.module('auth').registerStudent({ full_name: 'Test Person', email: 'known@example.invalid', password: 'LongPassword123!', student_number: 'TEST-100', course: 'BSIT', year_level: 4 });
  assert.equal(result.error.code, 'DUPLICATE_REQUEST');
  assert.doesNotMatch(result.error.message, /known@example.invalid/);
  assert.equal(fixture.deleted, 0);
  assert.equal(fixture.writes.some(write => write.table === 'students' && write.op === 'upsert'), false);
});

test('student approval requires a verified email before activation', async () => {
  const fixture = workflowFixture('Coordinator', { unconfirmedUsers: ['student-target'] });
  fixture.tables.users.push({ user_id: 'student-target', role: 'Student', account_status: 'pending', email: 'test@example.invalid' });
  const result = await fixture.module('auth').updateStudentAccountStatus('student-target', 'active');
  assert.equal(result.error.code, 'FORBIDDEN');
  assert.equal(fixture.tables.users[1].account_status, 'pending');
  assert.equal(fixture.writes.some(write => write.table === 'users' && write.op === 'update'), false);
});

test('staff provisioning rolls back failed profile saves and activates only complete accounts', async () => {
  for (const failingTable of ['users', 'coordinators', null]) {
    const fixture = workflowFixture('Admin', { fail: (table, op) => table === failingTable && op === 'upsert' ? 'write failed' : null });
    const result = await fixture.module('admin').createSystemUser({ full_name: 'Test Staff', email: 'staff@example.invalid', password: 'Password123!', role: 'Coordinator' });
    if (failingTable) {
      assert.equal(result.error.code, 'SERVER_FAILURE');
      assert.equal(fixture.deleted, 1);
      assert.equal(fixture.tables.users.some(row => row.user_id === 'new-user'), false);
      assert.equal(fixture.events.length, 0);
    } else {
      assert.equal(result.error, null);
      assert.equal(fixture.tables.users.find(row => row.user_id === 'new-user').account_status, 'active');
      assert.equal(fixture.tables.coordinators.length, 1);
    }
  }
});

test('administrator cannot disable their own account or report success for a missing user', async () => {
  const fixture = workflowFixture('Admin');
  assert.equal((await fixture.module('admin').updateUserAccountStatus('actor', 'inactive')).error.code, 'VALIDATION_FAILURE');
  assert.equal(fixture.tables.users[0].account_status, 'active');
  assert.equal((await fixture.module('admin').updateUserAccountStatus('missing', 'active')).error.code, 'NOT_FOUND');
  assert.equal(fixture.events.length, 0);
});

test('admin overview reports database failures instead of zero statistics', async () => {
  const fixture = workflowFixture('Admin', { fail: table => table === 'attendance' ? 'database unavailable' : null });
  const result = await fixture.module('admin').getSystemOverview();
  assert.equal(result.data, null);
  assert.equal(result.error.code, 'SERVER_FAILURE');
});

test('report review and endorsement fail when no accessible report was updated', async () => {
  for (const role of ['Coordinator', 'Supervisor']) {
    const fixture = workflowFixture(role);
    const reports = fixture.module('reports');
    const result = role === 'Coordinator' ? await reports.reviewReport('missing', 'approved')
      : await reports.endorseReportBySupervisor('missing', 'Reviewed the weekly report.');
    assert.equal(result.error.code, 'NOT_FOUND');
    assert.equal(fixture.events.length, 0);
  }
});

test('revoked certificates do not mark a trainee cleared in the admin roster', async () => {
  const fixture = workflowFixture('Admin', { tables: { students: [{
    student_id: 'student', student_number: '1', course: 'BSIT', year_level: 4,
    users: { full_name: 'Test Student', email: 'test@example.invalid', account_status: 'active' },
    certificates: [{ status: 'revoked', verification_code: 'REVOKED' }],
  }] } });
  const result = await fixture.module('admin').getPracticumRosterReport();
  assert.equal(result.data.roster[0].certificate_issued, false);
  assert.notEqual(result.data.roster[0].clearance_status, 'Cleared');
});

test('core student, coordinator, supervisor, and program-head service paths return useful results', async () => {
  const student = workflowFixture('Student', { tables: { students: [{ student_id: 'student', user_id: 'actor' }] } });
  assert.equal((await student.module('reports').submitReport({ report_type: 'weekly_report', file_path: 'actor/report.pdf' })).error, null);
  assert.equal(student.tables.reports[0].student_id, 'student');

  const coordinator = workflowFixture('Coordinator', { tables: { supervisors: [{ supervisor_id: 'supervisor', company_id: 'company' }] } });
  const assignment = await coordinator.module('assignments').createAssignment({ student_id: 'student', supervisor_id: 'supervisor', company_id: 'company', start_date: '2026-10-05' });
  assert.equal(assignment.error, null);
  assert.equal(coordinator.tables.student_assignments[0].assignment_status, 'active');

  const supervisor = workflowFixture('Supervisor', { tables: {
    supervisors: [{ user_id: 'actor', supervisor_id: 'supervisor' }],
    student_assignments: [{ student_id: 'student', supervisor_id: 'supervisor', assignment_id: 'assignment', assignment_status: 'active' }],
  } });
  assert.equal((await supervisor.module('evaluations').createEvaluation({ student_id: 'student', performance_score: 85, feedback: 'Good progress.', evaluation_type: 'midterm' })).error, null);
  assert.equal(supervisor.tables.evaluations[0].performance_score, 85);

  const head = workflowFixture('ProgramHead', { tables: { program_heads: [{ user_id: 'actor', department_or_program: 'ICS' }], students: [{ student_id: 'student', course: 'BSIT', users: { account_status: 'active' }, internship_progress: { completed_hours: 120, progress_status: 'in_progress' } }] } });
  const summary = await head.module('progress').getDepartmentSummary();
  assert.equal(summary.error, null);
  assert.equal(summary.data.totalStudents, 1);
  assert.equal(summary.data.totalRenderedHours, 120);
});

test('course filtering happens before pending-student pagination and returns a filtered total', async () => {
  const fixture = workflowFixture('Coordinator');
  for (let index = 0; index < 30; index++) fixture.tables.users.push({
    user_id: `student-${index}`, role: 'Student', account_status: 'pending',
    students: { student_number: String(index), course: index < 20 ? 'BSIT' : 'BSENTREP', year_level: 4 },
  });
  const result = await fixture.module('auth').listPendingStudents(1, 5, 'BSENTREP');
  assert.equal(result.error, null);
  assert.equal(result.data.total, 10);
  assert.equal(result.data.students.length, 5);
  assert.equal(result.data.students.every(row => row.course === 'BSENTREP'), true);
});

test('role boundaries reject other roles, anonymous users, and inactive users before privileged service access', async () => {
  const cases = [
    ['admin', 'listAllUsers', [], ['Admin']],
    ['auth', 'listPendingStudents', [], ['Coordinator', 'Admin', 'ProgramHead']],
    ['attendance', 'listAttendanceForSupervisor', [], ['Supervisor']],
    ['attendance', 'batchVerifyAttendance', [[attendanceId(1)]], ['Supervisor']],
    ['assignments', 'listAssignments', [], ['Coordinator', 'Admin', 'ProgramHead']],
    ['companies', 'listCompanies', [], ['Coordinator', 'Admin', 'ProgramHead']],
    ['evaluations', 'listEvaluationsForSupervisor', [], ['Supervisor']],
    ['progress', 'getDepartmentSummary', [], ['Coordinator', 'Admin', 'ProgramHead']],
    ['reports', 'listStudentReports', [], ['Student']],
    ['reports', 'reviewReport', ['report', 'approved'], ['Coordinator', 'Admin', 'ProgramHead']],
    ['reports', 'endorseReportBySupervisor', ['report', 'Feedback'], ['Supervisor']],
    ['schedule', 'listPracticumSchedules', [], ['Coordinator', 'Admin', 'ProgramHead']],
    ['announcements', 'createAnnouncement', [{ title: 'Test', content: 'Test' }], ['Coordinator', 'Admin']],
    ['certificates', 'checkClearanceStatus', ['student'], ['Student', 'Coordinator', 'Admin', 'ProgramHead']],
    ['certificates', 'issueCertificate', ['student'], ['Coordinator', 'Admin']],
    ['certificates', 'revokeCertificate', ['certificate', 'Reason'], ['Coordinator', 'Admin']],
    ['evaluations', 'overrideEvaluation', ['evaluation', 80, 'Reason'], ['Coordinator', 'Admin', 'ProgramHead']],
    ['reports', 'sendRequirementReminder', ['student-user', ['Report']], ['Coordinator', 'Admin', 'ProgramHead']],
    ['companies', 'setCompanyStatus', ['company', 'inactive'], ['Coordinator', 'Admin']],
    ['companies', 'getDeploymentMapData', [], ['Coordinator', 'Admin']],
  ];
  for (const [module, method, args, allowed] of cases) {
    for (const role of [null, 'Student', 'Supervisor', 'Coordinator', 'ProgramHead', 'Admin']) {
      for (const status of ['active', 'inactive']) {
        if (status === 'active' && allowed.includes(role)) continue;
        const fixture = workflowFixture(role, { status });
        const result = await fixture.module(module)[method](...args);
        assert.equal(result.error?.code, 'FORBIDDEN', `${role}/${status} must not call ${method}`);
        assert.equal(fixture.serviceCalls, 0, `${method} must stop before service-role access`);
        assert.equal(fixture.writes.length, 0);
      }
    }
  }
});

function load(relative, mocks = {}, env = {}, globals = {}) {
  const filename = path.resolve(root, relative);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports, Buffer, File, FormData, Date, URL, Request, Response, AbortSignal,
    setTimeout: globals.setTimeout || setTimeout, clearTimeout: globals.clearTimeout || clearTimeout,
    __DEV__: globals.__DEV__ || false, process: { env, cwd: () => path.join(root, 'apps/web') },
    document: globals.document,
    console: globals.console || console,
    fetch: globals.fetch || fetch,
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === '@/src/lib/supabase/public-url') return load('apps/web/src/lib/supabase/public-url.ts');
      if (name === '@/src/lib/department-scope') return load('apps/web/src/lib/department-scope.ts', { 'server-only': {} });
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
    '@/src/lib/audit': { recordAuditEvent: async () => {} },
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
    '@/src/lib/audit': { recordAuditEvent: async () => {} },
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
  assert.equal(audit.recordAuditEvent, undefined, 'internal audit writer must not be exported as a Server Action');
  assert.equal(result.error.code, 'SERVER_FAILURE');
  assert.equal(result.data, null);
  assert.ok(logs.some(line => line.includes('database unavailable')));
});


test('former supervisors cannot verify attendance or submit evaluations through service-role actions', async () => {
 const fixture = workflowFixture('Supervisor', {tables:{
  supervisors:[{user_id:'actor',supervisor_id:'supervisor'}],
  student_assignments:[{assignment_id:'assignment',student_id:'student',supervisor_id:'supervisor',assignment_status:'completed'}],
  attendance:[{attendance_id:attendanceId(1),student_id:'student',verification_status:'pending'}],
 }});
 assert.equal((await fixture.module('attendance').verifyAttendance(attendanceId(1),'verified')).error.code,'FORBIDDEN');
 assert.equal((await fixture.module('evaluations').createEvaluation({student_id:'student',performance_score:80,feedback:'Test',evaluation_type:'final'})).error.code,'FORBIDDEN');
 assert.equal(fixture.writes.length,0);
});


test('desktop export rejects untrusted frames, path traversal, changed folders and overwrite', () => {
  const { createDesktopSecurity } = require('../apps/desktop/src/security');
  const folder = path.resolve(root, 'synthetic-exports');
  const writes = new Map();
  let redirected = false;
  const disk = {
    realpathSync(value) { return redirected ? value + '-replaced' : value; },
    writeFileSync(name, bytes, options) {
      assert.equal(options.flag, 'wx');
      if (writes.has(name)) { const error = new Error('Exists'); error.code = 'EEXIST'; throw error; }
      writes.set(name, bytes);
    },
  };
  const frame = { url: 'https://portal.example/coordinator' };
  const win = { webContents: { mainFrame: frame } };
  const event = { sender: win.webContents, senderFrame: frame };
  const security = createDesktopSecurity(() => win, 'https://portal.example', path.join(root, 'loader.html'), disk);
  const input = { folderPath: folder, fileName: 'report.csv', fileData: Buffer.from('name,hours').toString('base64') };
  assert.throws(() => security.saveFile(event, input), /Choose/);
  security.selectFolder(event, folder);
  for (const fileName of ['../outside.csv', 'C:\\outside.csv', 'CON.csv', 'report.exe', 'report.csv.', 'report.csv:stream']) {
    assert.throws(() => security.saveFile(event, { ...input, fileName }), /valid export/);
  }
  assert.throws(() => security.saveFile({ sender: {}, senderFrame: frame }, input), /Untrusted/);
  assert.throws(() => security.saveFile({ sender: win.webContents, senderFrame: { url: frame.url } }, input), /Untrusted/);
  frame.url = 'https://attacker.example';
  assert.throws(() => security.saveFile(event, input), /Untrusted/);
  assert.equal(security.allowNavigation(frame.url), false);
  frame.url = 'https://portal.example/reports';
  redirected = true;
  assert.throws(() => security.saveFile(event, input), /Destination changed/);
  redirected = false;
  assert.equal(security.saveFile(event, input).success, true);
  assert.equal(writes.size, 1);
  assert.throws(() => security.saveFile(event, input), { code: 'EEXIST' });
  security.clearFolder();
  assert.throws(() => security.saveFile(event, { ...input, fileName: 'other.csv' }), /Choose/);
});

function offlineQueueFixture(raw = null) {
  const state = { raw, writes: 0, deleted: [], failWrite: false };
  const queue = load('apps/mobile/src/lib/offlineQueue.ts', {
    '@ojt/shared': { getAttendanceDate: () => '2026-10-08' },
    'expo-secure-store': {
      async getItemAsync() { return state.raw; },
      async setItemAsync(_key, value) { if (state.failWrite) throw new Error('Disk full'); state.writes++; state.raw = value; },
    },
    'expo-file-system/legacy': { documentDirectory: 'file:///private/', async deleteAsync(uri) { state.deleted.push(uri); } },
  });
  return { state, queue };
}
const queuedAttendance = { type: 'time_in', student_id: 's1', assignment_id: 'a1', local_photo_uri: 'file:///private/offline_selfies/a.jpg', captured_at: '2026-10-08T01:00:00Z', attendance_date: '2026-10-08' };

test('unreadable offline attendance remains untouched when enqueue is attempted', async () => {
  for (const corrupt of ['{broken', '{}', '[{}]']) {
    const { state, queue } = offlineQueueFixture(corrupt);
    await assert.rejects(queue.enqueueOfflineAttendance(queuedAttendance), /Do not clear app data/);
    assert.equal(state.raw, corrupt);
    assert.equal(state.writes, 0);
  }
});

test('concurrent offline enqueue preserves both records and failed removal preserves photo', async () => {
  const { state, queue } = offlineQueueFixture();
  const [first, second] = await Promise.all([
    queue.enqueueOfflineAttendance(queuedAttendance),
    queue.enqueueOfflineAttendance({ ...queuedAttendance, type: 'time_out' }),
  ]);
  assert.equal((await queue.getOfflineQueue()).length, 2);
  state.failWrite = true;
  await assert.rejects(queue.removeOfflineQueueItem(first.id), /Disk full/);
  assert.equal((await queue.getOfflineQueue()).length, 2);
  assert.equal(state.deleted.length, 0);
  state.failWrite = false;
  await queue.removeOfflineQueueItem(first.id);
  assert.equal(state.deleted.length, 0, 'photo is still referenced by second entry');
  await queue.removeOfflineQueueItem(second.id);
  assert.equal((await queue.getOfflineQueue()).length, 0);
  assert.deepEqual(state.deleted, [queuedAttendance.local_photo_uri]);
});


test('registration upload bounds requests before invoking the upload service', async () => {
  let calls = 0;
  const route = load('apps/web/app/api/registration/id-card/route.ts', {
    '@/src/services/auth': { async uploadStudentIdCard(form) { calls++; assert.equal(form.get('email'), 'test@example.invalid'); return { data: { file_path: 'id-cards/test.jpg' }, error: null }; } },
  });
  assert.equal((await route.POST(new Request('https://portal.example/api/registration/id-card', { method: 'POST', body: '{}' }))).status, 400);
  assert.equal((await route.POST(new Request('https://portal.example/api/registration/id-card', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=test', 'content-length': String(7*1024*1024) }, body: 'x' }))).status, 413);
  const oversized = new Request('https://portal.example/api/registration/id-card', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=test' }, body: new Uint8Array(6*1024*1024+1) });
  assert.equal((await route.POST(oversized)).status, 413);
  assert.equal(calls, 0);
  const form = new FormData(); form.set('email','test@example.invalid'); form.set('file',file('id.jpg','image/jpeg',[255,216,255]));
  const result = await route.POST(new Request('https://portal.example/api/registration/id-card', { method: 'POST', body: form }));
  assert.equal(result.status, 200); assert.equal(calls, 1);
});

test('readiness checks allowed schema revision and private bucket without reading internal counters', async () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic' };
  function ready(revision, storage, globals = {}) {
    return load('apps/web/app/ready/route.ts', { '@/src/lib/supabase/service': { getServiceClient: () => ({
      from: () => { throw new Error('readiness must not directly inspect internal counters'); },
      rpc: () => ({ abortSignal: () => Promise.resolve({ data: revision, error: null }) }),
      storage: { getBucket: () => storage },
    }) } }, env, globals);
  }
  const bucket = Promise.resolve({ data: { public: false }, error: null });
  assert.equal((await ready(32, bucket).GET()).status, 503);
  assert.equal((await ready(33, bucket).GET()).status, 200);
  assert.equal((await ready(31, bucket).GET()).status, 503);
  assert.equal((await ready(30, bucket).GET()).status, 503);
  const hanging = ready(33, new Promise(() => {}), { setTimeout(callback, ms) { assert.equal(ms, 4000); return setTimeout(callback, 1); } });
  assert.equal((await hanging.GET()).status, 503);
});
test('mobile recovery requires an explicit HTTPS portal for release builds', () => {
  const module = env => load('apps/mobile/src/lib/webPortal.ts', {}, env);
  assert.throws(() => module({}).getWebPortalUrl('/auth/reset-password'), /not configured/);
  assert.throws(() => module({ EXPO_PUBLIC_WEB_URL: 'http://portal.example' }).getWebPortalUrl('/auth/reset-password'), /secure connection/);
  assert.equal(module({ EXPO_PUBLIC_WEB_URL: 'https://portal.example' }).getWebPortalUrl('/auth/reset-password?role=Student'), 'https://portal.example/auth/reset-password?role=Student');
});
test('Docker server Supabase URLs are rewritten to the browser origin for signed links', () => {
  const helper = load('apps/web/src/lib/supabase/public-url.ts', {}, {
    SUPABASE_URL: 'http://host.docker.internal:54321',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  });
  const internalUrl = 'http://host.docker.internal:54321/storage/v1/object/sign/private-documents/student/report.pdf?token=one-time';
  assert.equal(
    helper.toPublicSupabaseUrl(internalUrl),
    'http://127.0.0.1:54321/storage/v1/object/sign/private-documents/student/report.pdf?token=one-time',
  );
  const externalUrl = 'https://cdn.example.test/report.pdf';
  assert.equal(helper.toPublicSupabaseUrl(externalUrl), externalUrl);
});
