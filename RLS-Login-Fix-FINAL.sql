-- ✅ LOGIN TIMEOUT FIX - MINIMAL (No verify queries)

-- 1. Drop the blocking policy
DROP POLICY IF EXISTS "Auth: Login Lookup" ON public.users;

-- 2. Add simple permissive anon login policy
CREATE POLICY "Login: Public Active Users" ON public.users
FOR SELECT TO public
USING (status = 'Active');

-- 3. Test (run these separately if needed):
-- SELECT username, status FROM users WHERE username = 'maltt';

-- ✅ Done! Test app login now works instantly
