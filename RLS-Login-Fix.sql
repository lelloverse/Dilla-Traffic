-- 🔥 FIX LOGIN TIMEOUT: RLS Policy for Anon Username Lookup
-- Run this in Supabase Dashboard → SQL Editor

-- 1. DROP restrictive policy
DROP POLICY IF EXISTS "Auth: Login Lookup" ON users;

-- 2. ADD permissive anon policy for login (username/email lookup only)
CREATE POLICY "Public: Login Username Lookup" ON users 
FOR SELECT TO anon 
USING (
  status = 'Active' 
  AND (username = current_setting('app.current_username', true) OR email = current_setting('app.current_username', true))
);

-- 3. ALSO allow basic anon lookup (fallback)
CREATE POLICY "Public: Active Users Lookup" ON users 
FOR SELECT TO anon 
USING (status = 'Active');

-- 4. Test immediately:
-- SET app.current_username = 'maltt';
-- SELECT * FROM users WHERE username = 'maltt';

-- 5. Verify policy active:
SELECT * FROM pg_policies WHERE tablename = 'users' AND roles = 'anon';

-- ✅ Test: App login should now work instantly (no 10s timeout)
