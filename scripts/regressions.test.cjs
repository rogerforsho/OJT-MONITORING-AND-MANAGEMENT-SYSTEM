const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const ts = require('typescript');

// Execute the real TypeScript services, replacing only device/backend APIs.
function loader(mocks, globals = {}) {
  const modules = new Map();
  function load(relative) {
    let filename = path.resolve(root, relative);
    if (!path.extname(filename)) filename += '.ts';
    if (mocks[filename]) return mocks[filename];
    if (modules.has(filename)) return modules.get(filename);
    const exports = {};
    modules.set(filename, exports);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: filename,
    }).outputText;
    vm.runInNewContext(output, {
      exports, console, setTimeout, clearTimeout, Date, Buffer, URL,
      process: { env: {} },
      require(name) {
        if (mocks[name]) return mocks[name];
        if (name === '@ojt/shared') return load('shared/attendanceDate.ts');
        if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name));
        return require(name);
      },
      ...globals,
    }, { filename });
    return exports;
  }
  return load;
}

function mobileFixture() {
  const store = new Map();
  const calls = [];
  const state = {
    online: true,
    userId: 'user-a', studentId: 'student-a',
    record: null, updateResult: null,
    now: '2026-10-05T07:30:00+08:00',
  };
  const secureStore = {
    async getItemAsync(key) { return store.get(key) ?? null; },
    async setItemAsync(key, value) { store.set(key, value); },
    async deleteItemAsync(key) { store.delete(key); },
  };
  const supabase = {
    auth: {
      async getUser() {
        calls.push('auth');
        if (!state.online) throw new Error('Network unavailable');
        return { data: { user: state.userId ? { id: state.userId } : null }, error: null };
      },
      async signOut() { state.userId = null; },
    },
    from(table) {
      calls.push(table);
      if (!state.online) throw new Error('Network unavailable');
      let operation = 'select';
      const query = {
        select() { return this; }, eq() { return this; }, is() { return this; },
        update(values) { operation = 'update'; calls.push({ update: values }); return this; },
        insert(values) { operation = 'insert'; calls.push({ insert: values });
          state.record = { ...values, attendance_id: 'server-record', time_out: null }; return this; },
        async single() { return this.maybeSingle(); },
        async maybeSingle() {
          if (table === 'students' && state.studentLookup) return state.studentLookup();
          if (operation === 'update') return { data: state.updateResult, error: null };
          if (operation === 'insert') return { data: { attendance_id: 'server-record' }, error: null };
          const data = table === 'users' ? {
            user_id: state.userId, role: 'Student', account_status: 'active',
            full_name: 'Test Student', email: 'student@example.test',
          } : table === 'students' ? { student_id: state.studentId }
            : table === 'student_assignments' ? {
              assignment_id: `assignment-${state.studentId}`, company_id: 'company',
              companies: { company_name: 'Test Company', geofence_enabled: true },
            } : table === 'attendance' ? state.record : null;
          return { data, error: null };
        },
      };
      return query;
    },
    storage: { from() { return { async upload(filename) {
      calls.push({ upload: filename }); return { data: { path: filename }, error: null };
    } }; } },
  };
  const FixedDate = class extends Date {
    constructor(...args) { super(...(args.length ? args : [state.now])); }
    static now() { return new Date(state.now).getTime(); }
  };
  const load = loader({
    [path.join(root, 'apps/mobile/src/lib/supabase.ts')]: { supabase },
    [path.join(root, 'apps/mobile/src/lib/storage.ts')]: {
      async uploadSelfieToStorage() { throw new Error('Unexpected online upload'); },
    },
    'expo-secure-store': secureStore,
    'expo-network': { async getNetworkStateAsync() {
      return { isConnected: state.online, isInternetReachable: state.online };
    } },
    'expo-file-system/legacy': {
      documentDirectory: 'file:///test/',
      async getInfoAsync() { return { exists: true }; },
      async makeDirectoryAsync() {}, async writeAsStringAsync() {}, async copyAsync() {},
      async deleteAsync() {}, async readAsStringAsync() { return 'AQID'; },
    },
  }, { Date: FixedDate });
  const attendance = load('apps/mobile/src/services/attendance.ts');
  const cache = load('apps/mobile/src/lib/attendanceCache.ts');
  const queue = load('apps/mobile/src/lib/offlineQueue.ts');
  const sync = load('apps/mobile/src/lib/syncEngine.ts');
  return {
    state, store, calls, attendance, cache, queue, sync, load,
    async prepareOffline() {
      assert.ok(await attendance.getActiveAssignment());
      state.online = false;
      calls.length = 0;
    },
  };
}

test('offline time-in uses the cached identity without any auth/database call', async () => {
  const f = mobileFixture();
  await f.prepareOffline();
  const result = await f.attendance.recordTimeIn('file:///selfie.jpg');
  assert.equal(result.error, null);
  assert.equal(result.data.isOffline, true);
  const queue = await f.queue.getOfflineQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].student_id, 'student-a');
  assert.equal(queue[0].attendance_date, '2026-10-05');
  assert.deepEqual(f.calls, []);
});

test('offline time-in/out survives reload, displays time-out, and rejects duplicates', async () => {
  const f = mobileFixture();
  await f.prepareOffline();
  await f.attendance.recordTimeIn('file:///selfie.jpg');
  assert.equal((await f.attendance.recordTimeIn('file:///selfie.jpg')).error.code, 'DUPLICATE_REQUEST');
  const today = await f.attendance.getTodayAttendance();
  assert.equal(today.attendance_id, 'offline_pending');
  f.state.now = '2026-10-05T17:00:00+08:00';
  assert.equal((await f.attendance.recordTimeOut(today.attendance_id, 'file:///out.jpg')).error, null);
  assert.ok((await f.attendance.getTodayAttendance()).time_out);
  assert.ok((await f.attendance.recordTimeOut(today.attendance_id, 'file:///out.jpg')).error);
  assert.equal((await f.queue.getOfflineQueue()).length, 2);
  assert.deepEqual(f.calls, []);
});

test('offline app bootstrap restores only the cached active student', async () => {
  const f = mobileFixture();
  await f.prepareOffline();
  const auth = f.load('apps/mobile/src/services/auth.ts');
  assert.equal((await auth.getAuthUser()).user_id, 'user-a');
  await f.cache.clearAttendanceIdentity();
  assert.equal(await auth.getAuthUser(), null);
  assert.equal((await f.attendance.recordTimeIn('file:///selfie.jpg')).error.code, 'UNAUTHORIZED');
  assert.deepEqual(f.calls, []);
});

test('switching accounts cannot reuse the previous student assignment or attendance', async () => {
  const f = mobileFixture();
  await f.prepareOffline();
  await f.attendance.recordTimeIn('file:///selfie.jpg');
  await f.cache.clearAttendanceIdentity();
  f.state.userId = 'user-b'; f.state.studentId = 'student-b'; f.state.online = true;
  await f.cache.getAttendanceIdentity(true);
  f.state.online = false;
  assert.equal(await f.attendance.getActiveAssignment(), null);
  assert.equal(await f.attendance.getTodayAttendance(), null);
  assert.equal((await f.attendance.recordTimeIn('file:///selfie.jpg')).error.code, 'NOT_FOUND');
});

test('a previously loaded online time-in remains available for offline time-out', async () => {
  const f = mobileFixture();
  f.state.record = { attendance_id: 'server-record', student_id: 'student-a',
    attendance_date: '2026-10-05', time_in: '2026-10-04T23:30:00Z', time_out: null };
  await f.attendance.getTodayAttendance();
  f.state.online = false;
  f.calls.length = 0;
  assert.equal((await f.attendance.recordTimeOut('server-record', 'file:///out.jpg')).error, null);
  assert.equal((await f.queue.getOfflineQueue())[0].attendance_id, 'server-record');
  assert.deepEqual(f.calls, []);
});

test('sync ignores queued records belonging to another signed-in student', async () => {
  const f = mobileFixture();
  await f.prepareOffline();
  await f.attendance.recordTimeIn('file:///selfie.jpg');
  f.state.userId = 'user-b'; f.state.studentId = 'student-b'; f.state.online = true;
  const result = await f.sync.syncPendingOfflineAttendance();
  assert.equal(result.syncedCount, 0);
  assert.equal((await f.queue.getOfflineQueue()).length, 1);
  assert.equal(f.calls.some(c => c.upload || c.insert || c.update), false);
});

test('sync keeps a time-out queued if no attendance row was updated', async () => {
  const f = mobileFixture();
  f.state.record = { attendance_id: 'server-record', time_out: null };
  await f.queue.enqueueOfflineAttendance({ type: 'time_out', student_id: 'student-a',
    assignment_id: '', attendance_date: '2026-10-05', captured_at: f.state.now,
    local_photo_uri: 'file:///out.jpg' });
  const result = await f.sync.syncPendingOfflineAttendance();
  assert.equal(result.syncedCount, 0);
  assert.equal(result.errors.length, 1);
  assert.equal((await f.queue.getOfflineQueue()).length, 1);
});

test('a time-out retry recognizes a previously successful sync without another upload', async () => {
  const f = mobileFixture();
  await f.queue.enqueueOfflineAttendance({ type: 'time_out', student_id: 'student-a',
    assignment_id: '', attendance_date: '2026-10-05', captured_at: f.state.now,
    local_photo_uri: 'file:///out.jpg' });
  f.state.record = { attendance_id: 'server-record', time_out: f.state.now };
  const result = await f.sync.syncPendingOfflineAttendance();
  assert.equal(result.syncedCount, 1);
  assert.equal((await f.queue.getOfflineQueue()).length, 0);
  assert.equal(f.calls.some(c => c.upload || c.update), false);
});

test('sync retries an already saved time-in without uploading a duplicate', async () => {
  const f = mobileFixture();
  await f.prepareOffline();
  await f.attendance.recordTimeIn('file:///selfie.jpg');
  f.state.online = true;
  f.state.record = { attendance_id: 'server-record', time_in: f.state.now };
  const result = await f.sync.syncPendingOfflineAttendance();
  assert.equal(result.syncedCount, 1);
  assert.equal((await f.queue.getOfflineQueue()).length, 0);
  assert.equal(f.calls.some(c => c.upload || c.insert), false);
});

test('signing out during a profile lookup cannot restore the old offline identity', async () => {
  const f = mobileFixture();
  let finishLookup;
  f.state.studentLookup = () => new Promise(resolve => { finishLookup = resolve; });
  const remembering = f.cache.rememberAttendanceIdentity({ user_id: 'user-a',
    role: 'Student', account_status: 'active', email: 'test@example.test', full_name: 'Test' });
  await f.cache.clearAttendanceIdentity();
  finishLookup({ data: { student_id: 'student-a' }, error: null });
  assert.equal(await remembering, null);
  assert.equal(await f.cache.getCachedAttendanceIdentity(), null);
});

test('concurrent reconnect/manual sync submits each queued action once', async () => {
  const f = mobileFixture();
  await f.prepareOffline();
  await f.attendance.recordTimeIn('file:///in.jpg');
  await f.attendance.recordTimeOut('offline_pending', 'file:///out.jpg');
  f.state.online = true;
  f.state.updateResult = { attendance_id: 'server-record' };
  const first = f.sync.syncPendingOfflineAttendance();
  const second = f.sync.syncPendingOfflineAttendance();
  assert.equal(first, second);
  assert.equal((await first).syncedCount, 2);
  assert.equal((await f.queue.getOfflineQueue()).length, 0);
  assert.equal(f.calls.filter(c => c.upload).length, 2);
});

test('a missing online session invalidates the offline identity', async () => {
  const f = mobileFixture();
  await f.prepareOffline();
  f.state.online = true;
  f.state.userId = null;
  assert.equal(await f.load('apps/mobile/src/services/auth.ts').getAuthUser(), null);
  f.state.online = false;
  assert.equal(await f.cache.getCachedAttendanceIdentity(), null);
});

test('Philippine attendance date and weekday are correct at UTC and local midnight boundaries', () => {
  const { getAttendanceDate, getPhilippineClock } = loader({})('shared/attendanceDate.ts');
  for (const [timestamp, expected] of [
    ['2026-10-04T15:59:59Z', '2026-10-04'],
    ['2026-10-04T16:00:00Z', '2026-10-05'],
    ['2026-10-05T07:30:00+08:00', '2026-10-05'],
    ['2026-12-31T16:00:00Z', '2027-01-01'],
  ]) assert.equal(getAttendanceDate(new Date(timestamp)), expected);
  assert.equal(getPhilippineClock(new Date('2026-10-05T07:30:00+08:00')).getUTCDay(), 1);
});

function webFixture({ profile, user = null, production = false } = {}) {
  const { NextRequest, NextResponse } = require('next/server');
  const load = loader({
    'next/server': { NextResponse },
    '@supabase/ssr': { createServerClient() { return {
      auth: { async getUser() { return { data: { user } }; } },
      from() { return { select() { return this; }, eq() { return this; },
        async single() { return { data: profile ?? null, error: null }; } }; },
    }; } },
  }, { process: { env: {
    NODE_ENV: production ? 'production' : 'test',
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
  } } });
  const { middleware } = load('apps/web/middleware.ts');
  return (url, headers) => middleware(new NextRequest(url, { headers }));
}

test('public crawler metadata works without authentication; dashboard still redirects', async () => {
  const request = webFixture();
  for (const route of ['/robots.txt', '/sitemap.xml']) {
    assert.equal((await request(`http://localhost${route}`)).status, 200);
  }
  assert.equal((await request('http://localhost/dashboard')).status, 307);
});

test('forged user metadata cannot grant Admin access, and trusted Admin role still works', async () => {
  const forged = webFixture({ user: { id: 'user', user_metadata: { role: 'Admin' } },
    profile: { role: 'Student', account_status: 'active' } });
  const denied = await forged('http://localhost/admin');
  assert.equal(denied.status, 307);
  assert.match(denied.headers.get('location'), /unauthorized/);
  const admin = webFixture({ user: { id: 'admin', user_metadata: { role: 'Student' } },
    profile: { role: 'Admin', account_status: 'active' } });
  assert.equal((await admin('http://localhost/admin')).status, 200);
});

test('inactive or missing profiles cannot access protected pages', async () => {
  for (const profile of [null, { role: 'Admin', account_status: 'inactive' }]) {
    const request = webFixture({ user: { id: 'user' }, profile });
    assert.match((await request('http://localhost/admin')).headers.get('location'), /auth\/pending/);
  }
});

test('production HTTP works on loopback while deployed hosts still require HTTPS', async () => {
  const request = webFixture({ production: true });
  assert.equal((await request('http://127.0.0.1:3100/auth/sign-in', { 'x-forwarded-proto': 'http' })).status, 200);
  const deployed = await request('http://portal.example.test/auth/sign-in', { 'x-forwarded-proto': 'http' });
  assert.equal(deployed.status, 301);
  assert.match(deployed.headers.get('location'), /^https:/);
});

test('desktop IPC hides to tray and transitions between valid widget/window sizes', async () => {
  const handlers = new Map();
  const calls = [];
  const window = {
    isDestroyed: () => false, hide: () => calls.push('hide'),
    unmaximize: () => calls.push('unmaximize'),
    setMinimumSize: (w, h) => calls.push(['minimum', w, h]),
    setSize: (w, h) => calls.push(['size', w, h]),
    setAlwaysOnTop() {}, setMenuBarVisibility() {}, loadFile() {}, on() {},
    webContents: { on() {} },
  };
  const electron = {
    app: { isPackaged: true, requestSingleInstanceLock: () => true, on() {},
      whenReady: () => Promise.resolve(), quit() {} },
    BrowserWindow: function () { return window; },
    ipcMain: { on: (name, fn) => handlers.set(name, fn), handle: (name, fn) => handlers.set(name, fn) },
    Notification: { isSupported: () => false }, dialog: {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'apps/desktop/src/main.js'), 'utf8'), {
    require(name) { if (name === 'electron') return electron;
      if (name === './tray') return { createTray() {} };
      if (name === 'fs') return { existsSync: () => false };
      return require(name); },
    __dirname: path.join(root, 'apps/desktop/src'), process: { env: {} }, console,
    URL, setInterval() {}, clearInterval() {},
  });
  await Promise.resolve();
  handlers.get('minimize-to-tray')();
  handlers.get('toggle-mini-widget')({}, true);
  handlers.get('toggle-mini-widget')({}, false);
  assert.deepEqual(calls, ['hide', 'unmaximize', ['minimum', 380, 540], ['size', 380, 540],
    ['minimum', 980, 640], ['size', 1280, 840]]);
});
