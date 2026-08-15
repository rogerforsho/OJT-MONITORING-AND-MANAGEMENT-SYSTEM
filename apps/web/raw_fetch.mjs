const supabaseUrl = 'https://jhslfwczxkdhexjgssjr.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impoc2xmd2N6eGtkaGV4amdzc2pyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDYxNjQ0NiwiZXhwIjoyMTAwMTkyNDQ2fQ.qGfHQRvg-aiKN3TQAp2cCjvOlhng2NcaED_EIpNMLM8';

async function rawFetch() {
  console.log('Sending raw GET to /auth/v1/health ...');
  try {
    const healthRes = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    });
    console.log('Health Status:', healthRes.status, await healthRes.text());
  } catch (err) {
    console.error('Health fetch error:', err);
  }

  console.log('\nSending raw GET to /auth/v1/admin/users ...');
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    });
    console.log('Admin Users Status:', res.status, res.statusText);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log('Body:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }

  console.log('\nSending raw POST to /auth/v1/token?grant_type=password ...');
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@cdm.edu.ph',
        password: 'Password123!',
      }),
    });
    console.log('Token Status:', res.status, res.statusText);
    console.log('Body:', await res.text());
  } catch (err) {
    console.error('Token fetch error:', err);
  }
}

rawFetch();
