import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhslfwczxkdhexjgssjr.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impoc2xmd2N6eGtkaGV4amdzc2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MTY0NDYsImV4cCI6MjEwMDE5MjQ0Nn0.s4NQZCt3HENiIMlJNmZd3EzOb6e8m7c5S8TyN5bugOQ';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impoc2xmd2N6eGtkaGV4amdzc2pyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDYxNjQ0NiwiZXhwIjoyMTAwMTkyNDQ2fQ.qGfHQRvg-aiKN3TQAp2cCjvOlhng2NcaED_EIpNMLM8';

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const client = createClient(supabaseUrl, anonKey);

async function diagnose() {
  console.log('=== Step 1: List all users via Admin API ===');
  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error('List Users Error:', listError);
  } else {
    console.log(`Found ${listData.users.length} users in auth.users:`);
    listData.users.forEach(u => {
      console.log(`- [${u.id}] ${u.email} (confirmed: ${u.email_confirmed_at ? 'YES' : 'NO'}, identities: ${u.identities?.length || 0})`);
    });
  }

  console.log('\n=== Step 2: Set Password via Admin API for admin@cdm.edu.ph ===');
  const adminUser = listData?.users?.find(u => u.email === 'admin@cdm.edu.ph');
  if (adminUser) {
    const { data: updData, error: updError } = await adminClient.auth.admin.updateUserById(
      adminUser.id,
      { password: 'Password123!', email_confirm: true }
    );
    if (updError) {
      console.error('Update Password Error:', updError);
    } else {
      console.log('Password successfully set via Admin API for admin@cdm.edu.ph!');
    }
  }

  console.log('\n=== Step 3: Test Password Sign-in as client ===');
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email: 'admin@cdm.edu.ph',
    password: 'Password123!',
  });

  if (signInError) {
    console.error('Client Sign-In Error:', signInError);
  } else {
    console.log('SUCCESS! Client signed in successfully! User ID:', signInData.user.id);
    console.log('Session access_token length:', signInData.session.access_token.length);
  }
}

diagnose();
