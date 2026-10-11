// Isolated PostgreSQL test. Never loads .env or contacts Supabase.
// NODE_PATH must include @electric-sql/pglite (same as check-department-rls.cjs).
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'); const path=require('node:path'); const assert=require('node:assert/strict');
async function main(){
 const db=new PGlite(); let checks=0;
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 await db.exec(`
 CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 CREATE FUNCTION extensions.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid);
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;

 GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon,authenticated,service_role;
 `);
 const dir=path.join(__dirname,'../database/migrations');
 for(const file of fs.readdirSync(dir).filter(f=>/^\d{3}.*\.sql$/.test(f)).sort()){
   // PGlite has gen_random_uuid; only uuid-ossp extension loading is substituted.
   const sql=fs.readFileSync(path.join(dir,file),'utf8').replace(/^\uFEFF/,'').replace(/create extension if not exists "uuid-ossp";/i,'');
   try {await db.exec(sql);} catch(error){console.error(error);throw new Error(file+': '+error.message);}
 }
 const revision=(await db.query('SELECT public.ojt_security_revision() AS revision')).rows[0].revision;
 assert.equal(Number(revision),33,'migration 034 must advance readiness revision to 33');checks++;
 await db.exec(fs.readFileSync(path.join(__dirname,'../database/verification/launch_security_checks.sql'),'utf8'));
 checks++;
 // Reapplying the new migrations must be safe.
 for(const prefix of ['030_','031_','032_','033_','034_']) await db.exec(fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(f=>f.startsWith(prefix))),'utf8'));
 // This deployment's attendance table is missing an optional legacy QR column.
 // Re-run both migrations after removing that field to simulate the reported schema.
 await db.exec('ALTER TABLE public.attendance DROP COLUMN qr_validation_status');
 for(const prefix of ['030_','031_','032_','033_','034_']) await db.exec(fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(f=>f.startsWith(prefix))),'utf8'));
 checks++;
 await db.exec(`
 INSERT INTO users(user_id,full_name,email,role,account_status) VALUES
 ('${id(1)}','Student A','a@example.invalid','Student','active'),
 ('${id(2)}','Student B','b@example.invalid','Student','active'),
 ('${id(3)}','Supervisor','s@example.invalid','Supervisor','active'),
 ('${id(4)}','Coordinator','c@example.invalid','Coordinator','active'),
 ('${id(5)}','Head','h@example.invalid','ProgramHead','active');
 INSERT INTO students(student_id,user_id,student_number,course,year_level,required_hours) VALUES
 ('${id(11)}','${id(1)}','TEST-A','BSIT',4,486), ('${id(12)}','${id(2)}','TEST-B','BSBA',4,486);
 INSERT INTO companies(company_id,company_name,address,contact_person,contact_email,contact_number) VALUES ('${id(20)}','Synthetic','Test','Test','test@example.invalid','0');
 INSERT INTO supervisors(supervisor_id,user_id,company_id,position) VALUES ('${id(13)}','${id(3)}','${id(20)}','Test');
 INSERT INTO program_heads(user_id,department_or_program) VALUES ('${id(5)}','ICS');
 INSERT INTO student_assignments(assignment_id,student_id,company_id,supervisor_id,start_date) VALUES ('${id(30)}','${id(11)}','${id(20)}','${id(13)}','2026-10-01');
 INSERT INTO practicum_schedules(student_id,time_in,time_out,lunch_break_minutes,lunch_break_start,start_date,status,reviewed_by,reviewed_at) VALUES ('${id(11)}','08:00','17:00',60,'12:00','2026-10-01','approved','${id(4)}',now());
 `);
 async function asUser(n,sql){await db.exec(`RESET ROLE; SET ROLE authenticated; SET request.jwt.claim.sub='${id(n)}'`);return (await db.query(sql)).rows;}
 async function denied(n,sql){await assert.rejects(()=>asUser(n,sql),undefined,sql);checks++;}
 const att=status=>`INSERT INTO attendance(student_id,assignment_id,attendance_date,time_in,verification_status,time_in_selfie_path) VALUES ('${id(11)}','${id(30)}','2026-10-08','2026-10-08 08:00+08','${status}','${id(11)}/time-in.jpg')`;
 await denied(4,`UPDATE users SET role='Admin' WHERE user_id='${id(4)}'`);
 await denied(4,`UPDATE users SET account_status='active' WHERE user_id='${id(1)}'`);
 await denied(1,att('verified'));
 await asUser(1,att('pending'));checks++;
 await asUser(1,`UPDATE attendance SET time_out='2026-10-08 17:00+08',time_out_selfie_path='${id(11)}/out.jpg',time_out_lat=14.1,synced_at=now() WHERE student_id='${id(11)}'`);checks++;
 await denied(1,`UPDATE attendance SET time_in='2026-10-08 06:00+08' WHERE student_id='${id(11)}'`);
 await denied(1,`UPDATE attendance SET time_out='2026-10-08 19:00+08' WHERE student_id='${id(11)}'`);
 await asUser(3,`UPDATE attendance SET verification_status='verified' WHERE student_id='${id(11)}'`);checks++;
 await db.exec('RESET ROLE');
 const firstCredit=(await db.query("SELECT credited_hours FROM attendance WHERE attendance_date='2026-10-08'")).rows[0];
 assert.equal(Number(firstCredit.credited_hours),8);
 await db.exec('RESET ROLE');
 assert.equal(Number((await db.query("SELECT completed_hours FROM internship_progress WHERE student_id='"+id(11)+"'")).rows[0].completed_hours),8);checks++;
 await asUser(1,`INSERT INTO attendance(student_id,assignment_id,attendance_date,time_in,verification_status,time_in_selfie_path) VALUES ('${id(11)}','${id(30)}','2026-10-09','2026-10-09 12:30+08','pending','${id(11)}/partial.jpg')`);
 await asUser(1,`UPDATE attendance SET time_out='2026-10-09 13:30+08',time_out_selfie_path='${id(11)}/partial-out.jpg' WHERE attendance_date='2026-10-09'`);
 await asUser(3,`UPDATE attendance SET verification_status='verified' WHERE attendance_date='2026-10-09'`);
 await db.exec('RESET ROLE');
 assert.equal(Number((await db.query("SELECT credited_hours FROM attendance WHERE attendance_date='2026-10-09'")).rows[0].credited_hours),0.5);
 await asUser(1,`INSERT INTO attendance(student_id,assignment_id,attendance_date,time_in,verification_status,time_in_selfie_path) VALUES ('${id(11)}','${id(30)}','2026-10-12','2026-10-12 08:00+08','pending','${id(11)}/no-lunch.jpg')`);
 await asUser(1,`UPDATE attendance SET time_out='2026-10-12 11:00+08',time_out_selfie_path='${id(11)}/no-lunch-out.jpg' WHERE attendance_date='2026-10-12'`);
 await asUser(3,`UPDATE attendance SET verification_status='verified' WHERE attendance_date='2026-10-12'`);
 await db.exec('RESET ROLE');
 assert.equal(Number((await db.query("SELECT credited_hours FROM attendance WHERE attendance_date='2026-10-12'")).rows[0].credited_hours),3);
 await db.exec('RESET ROLE');
 assert.equal(Number((await db.query("SELECT completed_hours FROM internship_progress WHERE student_id='"+id(11)+"'")).rows[0].completed_hours),11.5);checks++;
  // Supervisor may verify before the student later submits time-out. The
  // verified row must receive its lunch-adjusted snapshot when time-out arrives.
  await asUser(1,`INSERT INTO attendance(student_id,assignment_id,attendance_date,time_in,verification_status,time_in_selfie_path) VALUES ('${id(11)}','${id(30)}','2026-10-13','2026-10-13 08:00+08','pending','${id(11)}/early-verify.jpg')`);
  await asUser(3,`UPDATE attendance SET verification_status='verified' WHERE attendance_date='2026-10-13'`);
  await db.exec('RESET ROLE');
  assert.equal((await db.query("SELECT credited_hours FROM attendance WHERE attendance_date='2026-10-13'")).rows[0].credited_hours,null);
  await asUser(1,`UPDATE attendance SET time_out='2026-10-13 17:00+08',time_out_selfie_path='${id(11)}/late-timeout.jpg' WHERE attendance_date='2026-10-13'`);
  await db.exec('RESET ROLE');
  assert.equal(Number((await db.query("SELECT credited_hours FROM attendance WHERE attendance_date='2026-10-13'")).rows[0].credited_hours),8);
  assert.equal(Number((await db.query("SELECT completed_hours FROM internship_progress WHERE student_id='"+id(11)+"'")).rows[0].completed_hours),19.5);checks++;
 await denied(1,`INSERT INTO reports(student_id,report_type,file_path,status) VALUES ('${id(11)}','weekly_report','a.pdf','approved')`);
 await asUser(1,`INSERT INTO reports(student_id,report_type,file_path) VALUES ('${id(11)}','weekly_report','a.pdf')`);checks++;
 await asUser(1,`UPDATE reports SET status='approved' WHERE student_id='${id(11)}'`);
 const protectedReport=(await asUser(1,`SELECT status,remarks FROM reports WHERE student_id='${id(11)}'`))[0];
 assert.equal(protectedReport.status,'submitted');assert.equal(protectedReport.remarks,null);checks++;
 await asUser(1,`UPDATE reports SET remarks='self-approved' WHERE student_id='${id(11)}'`);
 const stillProtected=(await asUser(1,`SELECT status,remarks FROM reports WHERE student_id='${id(11)}'`))[0];
 assert.equal(stillProtected.status,'submitted');assert.equal(stillProtected.remarks,null);checks++;
 await denied(3,`UPDATE reports SET status='approved' WHERE student_id='${id(11)}'`);
 await asUser(3,`UPDATE reports SET supervisor_feedback='Reviewed',supervisor_endorsed_at=now() WHERE student_id='${id(11)}'`);checks++;
 await asUser(5,`UPDATE reports SET status='approved' WHERE student_id='${id(11)}'`);checks++;
 await denied(1,`INSERT INTO practicum_schedules(student_id,start_date,status) VALUES ('${id(11)}','2026-10-01','approved')`);
 await assert.rejects(()=>asUser(1,`INSERT INTO practicum_schedules(student_id,start_date) VALUES ('${id(11)}','2026-10-01')`));checks++;
 await asUser(1,`INSERT INTO practicum_schedules(student_id,start_date,lunch_break_start) VALUES ('${id(11)}','2026-10-01','12:00')`);checks++;
 await denied(1,`UPDATE practicum_schedules SET reviewed_by='${id(4)}' WHERE student_id='${id(11)}'`);
 await asUser(5,`UPDATE practicum_schedules SET status='approved',reviewed_by='${id(5)}' WHERE student_id='${id(11)}'`);checks++;
 const evaluation=(student,score)=>`INSERT INTO evaluations(student_id,supervisor_id,performance_score,feedback,evaluation_date) VALUES ('${id(student)}','${id(13)}',${score},'Synthetic','2026-10-08')`;
 await denied(3,evaluation(12,90));await denied(3,evaluation(11,101));
 await asUser(3,evaluation(11,90));checks++;
 await denied(3,`UPDATE evaluations SET student_id='${id(12)}' WHERE student_id='${id(11)}'`);
 await db.exec(`RESET ROLE; UPDATE users SET account_status='inactive' WHERE user_id='${id(1)}'`);
 await denied(1,`INSERT INTO reports(student_id,report_type,file_path) VALUES ('${id(11)}','weekly_report','b.pdf')`);
 await db.exec('RESET ROLE; SET ROLE anon');
 await assert.rejects(()=>db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES ('private-documents','id-cards/test.jpg')"));checks++;
 await db.exec('RESET ROLE');
 await assert.rejects(()=>db.exec(`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ('${id(40)}','invalid@example.invalid','{"year_level":1,"course":"BSIT"}')`));checks++;
 await db.exec(`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ('${id(41)}','valid@example.invalid','{"year_level":4,"course":"BSIT","student_number":"VALID-TEST"}')`);checks++;
 await db.exec(`SET ROLE service_role; UPDATE users SET account_status='active' WHERE user_id='${id(41)}'`);checks++;
 console.log('PASS: '+checks+' migration/write-boundary checks using the repository migration chain and synthetic Auth/Storage. No remote database.');
 await db.close();
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
