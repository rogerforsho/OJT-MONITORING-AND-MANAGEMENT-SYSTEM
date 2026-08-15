import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhslfwczxkdhexjgssjr.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impoc2xmd2N6eGtkaGV4amdzc2pyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDYxNjQ0NiwiZXhwIjoyMTAwMTkyNDQ2fQ.qGfHQRvg-aiKN3TQAp2cCjvOlhng2NcaED_EIpNMLM8';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testRpc() {
  console.log('Testing RPC / Schema access...');
  
  // Test querying public.users
  const { data: users, error: uErr } = await supabase.from('users').select('user_id, email, role');
  console.log('public.users:', users);
}

testRpc();
