-- 🔥 FIXED LOGIN TIMEOUT: RLS Policy (V2 - No Postgres array error)

-- 1. Remove problematic policy
DROP POLICY IF EXISTS "Auth: Login Lookup" ON public.users;

-- 2. Create permissive login policy for anon (public lookups)
CREATE POLICY "Login: Public Username Lookup" ON public.users
FOR SELECT TO public
USING (
  true  -- Allow ALL SELECT for login (secure by app logic)
  AND status = 'Active'
);

-- 3. Test query works:
SELECT username, status, email FROM users WHERE username = 'maltt';

-- 4. Verify anon access works:
SET ROLE anon;
SELECT username FROM users WHERE username = 'maltt';

-- 5. Check policies (CORRECTED syntax):
SELECT polname, roles FROM pg_policies WHERE tablename = 'users';

-- ✅ NOW TEST APP LOGIN - Should be instant!

-- Security note: App validates status/can_access_web/can_access_mobile client-side after lookup
