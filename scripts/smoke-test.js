// Live check of the running server.   1) npm run seed   2) npm run dev   3) in a 2nd window: npm run smoke
// It creates a few throw-away test patients (smoke...@curalink-demo.test) and never touches real data.
// Optional: SMOKE_BASE (default http://localhost:5000), SMOKE_DOCTOR_EMAIL + SMOKE_DOCTOR_PASSWORD (adds a doctor-privacy check).
const BASE = process.env.SMOKE_BASE || 'http://localhost:5000';
const PASSWORD = 'Smoke@12345';
const run = Date.now().toString().slice(-8);

let passed = 0; let failed = 0; let skipped = 0;
const ok = (name) => { passed += 1; console.log(`  PASS  ${name}`); };
const bad = (name, why) => { failed += 1; console.log(`  FAIL  ${name}  ->  ${why}`); };
const skip = (name, why) => { skipped += 1; console.log(`  SKIP  ${name}  (${why})`); };
const expect = (name, cond, why = '') => (cond ? ok(name) : bad(name, why));

// A tiny browser: remembers the login cookie.
function client() {
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const tok = set.find((c) => c.startsWith('token='));
    if (tok) cookie = tok.split(';')[0];
    let json = null;
    try { json = await res.json(); } catch (_) { /* not JSON */ }
    return { status: res.status, json, setCookie: set.join('|') };
  };
  return { call, getCookie: () => cookie, setCookie: (c) => { cookie = c; } };
}

async function newPatient(tag) {
  const c = client();
  const email = `smoke${tag}${run}@curalink-demo.test`;
  const phone = `9${String(run).padStart(8, '0')}${tag}`.slice(0, 10);
  const reg = await c.call('POST', '/api/auth/register', {
    firstName: 'Smoke', lastName: `Test${tag}`, email, phone, dob: '1990-01-01', gender: 'female',
    city: 'Nashik', state: 'Maharashtra', password: PASSWORD, confirmPassword: PASSWORD,
  });
  if (reg.status !== 201) throw new Error(`Could not register a test patient (${reg.status}: ${JSON.stringify(reg.json)})`);
  const login = await c.call('POST', '/api/auth/login', { email, password: PASSWORD });
  if (login.status !== 200) throw new Error(`Could not log in the test patient (${login.status})`);
  return { c, email, phone };
}

async function findFreeSlot(c) {
  const list = await c.call('GET', '/api/doctors?limit=50');
  const doctors = (list.json && list.json.data && list.json.data.doctors) || [];
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  for (const d of doctors) {
    for (let i = 1; i <= 14; i += 1) {
      const date = new Date(Date.parse(`${today}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
      const s = await c.call('GET', `/api/doctors/${d._id}/slots?date=${date}`);
      const free = s.json && s.json.data && s.json.data.slots.find((x) => x.available);
      if (free) return { doctorId: d._id, date, time: free.time };
    }
  }
  return null;
}

(async () => {
  console.log(`Smoke test against ${BASE}\n`);
  try {
    const health = await fetch(`${BASE}/api/health`).catch(() => null);
    if (!health || !health.ok) { console.log('The server is not running. Start it with: npm run dev'); process.exit(1); }

    console.log('Access control');
    const anon = client();
    for (const p of ['/api/admin/dashboard', '/api/admin/patients', '/api/patients/profile', '/api/doctor/dashboard', '/api/appointments']) {
      const r = await anon.call('GET', p);
      expect(`not logged in -> 401 on ${p}`, r.status === 401, `got ${r.status}`);
    }

    const a = await newPatient('1');
    const b = await newPatient('2');
    for (const p of ['/api/admin/dashboard', '/api/admin/audit-logs', '/api/doctor/dashboard']) {
      const r = await a.c.call('GET', p);
      expect(`patient -> 403 on ${p}`, r.status === 403, `got ${r.status}`);
    }

    console.log('\nLogin');
    const wrongPw = await client().call('POST', '/api/auth/login', { email: a.email, password: 'Wrong@12345' });
    const noUser = await client().call('POST', '/api/auth/login', { email: `nobody${run}@curalink-demo.test`, password: 'Wrong@12345' });
    expect('wrong password -> 401', wrongPw.status === 401, `got ${wrongPw.status}`);
    expect('same message for unknown email (cannot guess who is registered)', noUser.status === 401 && noUser.json.message === wrongPw.json.message);
    const cookieFlags = (await client().call('POST', '/api/auth/login', { email: a.email, password: PASSWORD })).setCookie;
    expect('login cookie is HttpOnly', /httponly/i.test(cookieFlags), cookieFlags);
    expect('login cookie is SameSite', /samesite=(lax|strict)/i.test(cookieFlags), cookieFlags);
    const sneaky = await client().call('POST', '/api/auth/register', {
      firstName: 'Evil', lastName: 'Admin', email: `evil${run}@curalink-demo.test`, phone: `8${run}9`.slice(0, 10), dob: '1990-01-01', gender: 'male',
      city: 'X', state: 'Maharashtra', password: PASSWORD, confirmPassword: PASSWORD, role: 'admin',
    });
    if (sneaky.status === 201) {
      const c = client(); await c.call('POST', '/api/auth/login', { email: `evil${run}@curalink-demo.test`, password: PASSWORD });
      const me = await c.call('GET', '/api/auth/me');
      expect('cannot register as admin by sending role=admin', me.json.data.user.role === 'patient', `role is ${me.json.data.user.role}`);
    } else skip('register with role=admin', `registration returned ${sneaky.status}`);

    console.log('\nValidation');
    const badBook = await a.c.call('POST', '/api/appointments', { doctorId: 'not-an-id' });
    expect('bad booking data -> 400 with a readable message', badBook.status === 400 && badBook.json.message, `got ${badBook.status}`);
    const injection = await client().call('POST', '/api/auth/login', { email: { $gt: '' }, password: { $gt: '' } });
    expect('NoSQL injection in login -> rejected (400/401)', [400, 401].includes(injection.status), `got ${injection.status}`);

    console.log('\nForm safety');
    const xss = await client().call('POST', '/api/contact', {
      name: 'Tester', email: `x${run}@curalink-demo.test`, subject: 'Hello there', message: 'Hi <script>alert(1)</script> <img src=x onerror=alert(2)> thanks',
    });
    expect('contact form accepts a message', xss.status === 201, `got ${xss.status}: ${JSON.stringify(xss.json)}`);
    expect('script tags are not echoed back', !JSON.stringify(xss.json).includes('<script>'));

    console.log('\nDouble booking');
    const slot = await findFreeSlot(a.c);
    if (!slot) skip('double-booking race', 'no free slot found - run npm run seed first');
    else {
      const [r1, r2] = await Promise.all([
        a.c.call('POST', '/api/appointments', { ...slot, consultationType: 'in-person', reason: 'smoke test' }),
        b.c.call('POST', '/api/appointments', { ...slot, consultationType: 'in-person', reason: 'smoke test' }),
      ]);
      const codes = [r1.status, r2.status].sort();
      expect('two people book the same slot at once -> exactly one 201 and one 409', codes[0] === 201 && codes[1] === 409, `got ${codes.join(' and ')}`);
      const winner = r1.status === 201 ? { who: a, r: r1 } : { who: b, r: r2 };
      const loser = winner.who === a ? b : a;
      if (r1.status === 201 || r2.status === 201) {
        const id = winner.r.json.data.appointment._id;
        const cancel = await winner.who.c.call('PUT', `/api/appointments/${id}/cancel`, { reason: 'smoke test cleanup' });
        expect('winner can cancel', cancel.status === 200, `got ${cancel.status}`);
        const again = await loser.c.call('POST', '/api/appointments', { ...slot, consultationType: 'in-person', reason: 'smoke test retry' });
        expect('cancelling frees the slot for the other person', again.status === 201, `got ${again.status}`);
        if (again.status === 201) await loser.c.call('PUT', `/api/appointments/${again.json.data.appointment._id}/cancel`, { reason: 'smoke test cleanup' });
        const peek = await loser.c.call('GET', `/api/appointments/${id}`);
        expect("a patient cannot open someone else's appointment", [403, 404].includes(peek.status), `got ${peek.status}`);
      }
    }

    console.log('\nPassword change signs out other devices');
    const second = client(); // a second "device" with its own cookie
    await second.call('POST', '/api/auth/login', { email: b.email, password: PASSWORD });
    expect('second device is signed in', (await second.call('GET', '/api/auth/me')).status === 200);
    const newPw = 'Changed@54321';
    const ch = await b.c.call('PUT', '/api/patients/password', { currentPassword: PASSWORD, newPassword: newPw, confirmPassword: newPw });
    expect('password change works', ch.status === 200, `got ${ch.status}: ${JSON.stringify(ch.json)}`);
    expect('the other device is now signed out (401)', (await second.call('GET', '/api/auth/me')).status === 401);
    expect('this device stays signed in', (await b.c.call('GET', '/api/auth/me')).status === 200);
    expect('old password no longer works', (await client().call('POST', '/api/auth/login', { email: b.email, password: PASSWORD })).status === 401);

    console.log('\nDoctor privacy');
    if (!process.env.SMOKE_DOCTOR_EMAIL) skip('doctor cannot read a patient they have no appointment with', 'set SMOKE_DOCTOR_EMAIL and SMOKE_DOCTOR_PASSWORD (e.g. a seeded doctor, password Doctor@12345)');
    else {
      const d = client();
      const login = await d.call('POST', '/api/auth/login', { email: process.env.SMOKE_DOCTOR_EMAIL, password: process.env.SMOKE_DOCTOR_PASSWORD || 'Doctor@12345' });
      if (login.status !== 200) bad('doctor login', `got ${login.status}`);
      else {
        const me = (await a.c.call('GET', '/api/auth/me')).json.data.user.id;
        const r = await d.call('GET', `/api/doctor/patients/${me}`);
        expect('doctor opening a stranger patient -> 403/404', [403, 404].includes(r.status), `got ${r.status}`);
      }
    }
  } catch (err) {
    bad('test run', err.message);
  }
  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
  process.exit(failed ? 1 : 0);
})();
