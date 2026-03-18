-- ==========================================
-- ARCHITECTURAL SHIFT: JWT-BASED RLS POLICIES
-- ==========================================

-- ==========================================
-- 1. DROP EXISTING POLICIES AND FUNCTIONS
-- ==========================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Enable SELECT for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable INSERT for authenticated users" ON users;
DROP POLICY IF EXISTS "Users can update own record or Admins update any" ON users;
DROP POLICY IF EXISTS "Admins have DELETE access" ON users;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON vehicles;
DROP POLICY IF EXISTS "Enable read for anon" ON vehicles;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON drivers;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON violations;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON plates;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON payments;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON audit_logs;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON applications;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON alerts;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON activities;

-- Drop new JWT policies if they exist
DROP POLICY IF EXISTS "JWT: Admins have full access to users" ON users;
DROP POLICY IF EXISTS "JWT: Users can insert their own record" ON users;
DROP POLICY IF EXISTS "JWT: Users can view all users" ON users;
DROP POLICY IF EXISTS "JWT: Users can update own record" ON users;
DROP POLICY IF EXISTS "Woreda Isolation: Users access" ON users;
DROP POLICY IF EXISTS "Woreda Isolation: Violations access" ON violations;
DROP POLICY IF EXISTS "Woreda Isolation: Payments access" ON payments;
DROP POLICY IF EXISTS "JWT: Regional access to vehicles" ON vehicles;
DROP POLICY IF EXISTS "JWT: Regional access to drivers" ON drivers;
DROP POLICY IF EXISTS "Woreda Isolation: Audit Logs access" ON audit_logs;
DROP POLICY IF EXISTS "Woreda Isolation: Alerts access" ON alerts;
DROP POLICY IF EXISTS "Active alerts readable by all authenticated" ON alerts;
DROP POLICY IF EXISTS "Active alerts readable by anonymous" ON alerts;
DROP POLICY IF EXISTS "Woreda Isolation: Applications access" ON applications;
DROP POLICY IF EXISTS "Woreda Isolation: Activities access" ON activities;
DROP POLICY IF EXISTS "JWT: Regional access to plates" ON plates;
DROP POLICY IF EXISTS "Anonymous vehicle lookup" ON vehicles;
DROP POLICY IF EXISTS "Anonymous driver lookup" ON drivers;
DROP POLICY IF EXISTS "Woredas viewable by all authenticated" ON woredas;
DROP POLICY IF EXISTS "Only admins can modify woredas" ON woredas;
DROP POLICY IF EXISTS "Activities viewable by all authenticated" ON activities;

-- Drop helper functions if they exist
DROP FUNCTION IF EXISTS public.m_woreda_id CASCADE;
DROP FUNCTION IF EXISTS public.m_role CASCADE;
DROP FUNCTION IF EXISTS sync_user_role_to_metadata CASCADE;
DROP FUNCTION IF EXISTS handle_user_woreda_assignment CASCADE;

-- ==========================================
-- 2. CREATE JWT HELPER FUNCTIONS (in public schema)
-- ==========================================

-- Helper for RLS readability - get woreda_id from public.users (REAL-TIME, efficient)
CREATE OR REPLACE FUNCTION public.m_woreda_id() 
RETURNS UUID AS $$
  SELECT woreda_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper for RLS readability - get role from public.users (REAL-TIME, efficient)
CREATE OR REPLACE FUNCTION public.m_role() 
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==========================================
-- 3. CREATE ENHANCED ROLE SYNC TRIGGER
-- ==========================================

-- Syncs both role AND woreda_id to Supabase Auth app_metadata
CREATE OR REPLACE FUNCTION public.sync_user_to_auth() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$ 
BEGIN 
  -- Update auth.users metadata with role and woreda_id 
  UPDATE auth.users 
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object( 
      'role', NEW.role, 
      'woreda_id', NEW.woreda_id 
    ) 
  WHERE id = NEW.id; 
  
  RETURN NEW; 
END; 
$$; 

DROP TRIGGER IF EXISTS sync_user_to_auth_trigger ON users; 
CREATE TRIGGER sync_user_to_auth_trigger 
  AFTER INSERT OR UPDATE OF role, woreda_id ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION public.sync_user_to_auth(); 

-- ==========================================
-- 4. TRIGGER FOR AUTOMATIC WOREDA_ID ASSIGNMENT
-- ==========================================

CREATE OR REPLACE FUNCTION handle_user_woreda_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- If creator is WoredaAdmin, force the new user to their Woreda
  IF public.m_role() = 'WoredaAdmin' THEN
    NEW.woreda_id := public.m_woreda_id();
  END IF;
  
  -- If creator is Admin, they can set any Woreda (set in UI)
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_creation_woreda_sync ON users;
CREATE TRIGGER on_user_creation_woreda_sync
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION handle_user_woreda_assignment();

-- ==========================================
-- 5. REFINED USERS TABLE POLICIES (Hierarchy & Isolation)
-- ==========================================

-- Clean up existing policies to avoid name conflicts
DROP POLICY IF EXISTS "SuperAdmin: Full Access" ON users;
DROP POLICY IF EXISTS "WoredaAdmin: View District Staff" ON users;
DROP POLICY IF EXISTS "WoredaAdmin: Manage District Staff" ON users;
DROP POLICY IF EXISTS "Users: View Own Profile" ON users;
DROP POLICY IF EXISTS "Users: Update Own Profile" ON users;
DROP POLICY IF EXISTS "Auth: Anonymous Lookup" ON users;
DROP POLICY IF EXISTS "Auth: Signup Insert" ON users;
DROP POLICY IF EXISTS "JWT: Admins have full access to users" ON users;
DROP POLICY IF EXISTS "JWT: Users can insert their own record" ON users;
DROP POLICY IF EXISTS "JWT: Anonymous user lookup" ON users;
DROP POLICY IF EXISTS "JWT: Users can view all users" ON users;
DROP POLICY IF EXISTS "JWT: Users can update own record" ON users;
DROP POLICY IF EXISTS "Woreda Isolation: Users access" ON users;
DROP POLICY IF EXISTS "Auth: Login Lookup" ON users;
DROP POLICY IF EXISTS "Admin: Regional Access" ON users;
DROP POLICY IF EXISTS "WoredaAdmin: District View" ON users;
DROP POLICY IF EXISTS "WoredaAdmin: District Manage" ON users;
DROP POLICY IF EXISTS "Users: Self Update" ON users;

-- 1. LOGIN LOOKUP: Allow anonymous lookup by username (Critical for login flow)
CREATE POLICY "Auth: Login Lookup" ON users
FOR SELECT TO anon
USING (status = 'Active');

-- 2. SUPER ADMIN: Unrestricted access across all districts
CREATE POLICY "Admin: Regional Access" ON users
FOR ALL TO authenticated
USING (public.m_role() = 'Admin')
WITH CHECK (public.m_role() = 'Admin');

-- 3. WOREDA ADMIN: View access restricted to their district
CREATE POLICY "WoredaAdmin: District View" ON users
FOR SELECT TO authenticated
USING (
    (public.m_role() = 'WoredaAdmin' AND woreda_id = public.m_woreda_id())
    OR
    (id = auth.uid()) -- Can always see self
);

-- 4. WOREDA ADMIN: Management access restricted to district staff (Non-Admins only)
CREATE POLICY "WoredaAdmin: District Manage" ON users
FOR ALL TO authenticated
USING (
    public.m_role() = 'WoredaAdmin' 
    AND 
    woreda_id = public.m_woreda_id()
    AND 
    role IN ('Officer', 'Clerk') -- Cannot manage other WoredaAdmins or Admins
)
WITH CHECK (
    public.m_role() = 'WoredaAdmin' 
    AND 
    woreda_id = public.m_woreda_id()
    AND 
    role IN ('Officer', 'Clerk')
);

-- 5. SELF SERVICE: Users can always update their own record
CREATE POLICY "Users: Self Update" ON users
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 6. AUTH SYSTEM: Allow insertion during signup
CREATE POLICY "Auth: Signup Insert" ON users
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- GLOBAL TABLES (Vehicles & Drivers remain visible across woredas for history lookups)
CREATE POLICY "JWT: Regional access to vehicles" ON vehicles
FOR ALL TO authenticated
USING (public.m_role() IN ('Admin', 'WoredaAdmin', 'Officer', 'Clerk'));

CREATE POLICY "JWT: Regional access to drivers" ON drivers
FOR ALL TO authenticated
USING (public.m_role() IN ('Admin', 'WoredaAdmin', 'Officer', 'Clerk'));

-- Anonymous users can look up active drivers
CREATE POLICY "Anonymous driver lookup" ON drivers
FOR SELECT TO anon
USING (status = 'Active' AND deleted_at IS NULL);

-- ==========================================
-- 5.4 VIOLATIONS TABLE POLICIES (Woreda Isolated)
-- ==========================================

CREATE POLICY "Woreda Isolation: Violations access" ON violations
FOR ALL TO authenticated
USING (
    public.m_role() = 'Admin'
    OR 
    woreda_id = public.m_woreda_id()
)
WITH CHECK (
    public.m_role() = 'Admin'
    OR 
    woreda_id = public.m_woreda_id()
);

-- ==========================================
-- 5.5 PAYMENTS TABLE POLICIES (Woreda Isolated)
-- ==========================================

CREATE POLICY "Woreda Isolation: Payments access" ON payments
FOR ALL TO authenticated
USING (
    public.m_role() = 'Admin'
    OR 
    woreda_id = public.m_woreda_id()
)
WITH CHECK (
    public.m_role() = 'Admin'
    OR 
    woreda_id = public.m_woreda_id()
);

-- ==========================================
-- 5.6 PLATES TABLE POLICIES (Regional Access)
-- ==========================================

CREATE POLICY "JWT: Regional access to plates" ON plates
FOR ALL TO authenticated
USING (public.m_role() IN ('Admin', 'WoredaAdmin', 'Officer', 'Clerk'))
WITH CHECK (public.m_role() IN ('Admin', 'WoredaAdmin', 'Officer', 'Clerk'));

-- ==========================================
-- 5.7 AUDIT LOGS TABLE POLICIES (Woreda Isolated)
-- ==========================================

CREATE POLICY "Woreda Isolation: Audit Logs access" ON audit_logs
FOR ALL TO authenticated
USING (
    public.m_role() = 'Admin'
    OR 
    woreda_id = public.m_woreda_id()
)
WITH CHECK (
    public.m_role() = 'Admin'
    OR 
    woreda_id = public.m_woreda_id()
);

-- ==========================================
-- 5.8 ALERTS TABLE POLICIES (Woreda Isolated with Public BOLO)
-- ==========================================

-- Full access for admins and woreda staff to their own alerts
CREATE POLICY "Woreda Isolation: Alerts access" ON alerts
FOR ALL TO authenticated
USING (
    public.m_role() = 'Admin'
    OR 
    woreda_id = public.m_woreda_id()
)
WITH CHECK (
    public.m_role() = 'Admin'
    OR 
    woreda_id = public.m_woreda_id()
);

-- Allow reading active alerts across all woredas (for BOLO/stolen vehicles)
CREATE POLICY "Active alerts readable by all authenticated" ON alerts
FOR SELECT TO authenticated
USING (
    is_active = true
);

-- Anonymous users can see active BOLO alerts
CREATE POLICY "Active alerts readable by anonymous" ON alerts
FOR SELECT TO anon
USING (
    is_active = true AND category = 'BOLO'
);

-- ==========================================
-- 5.9 APPLICATIONS TABLE POLICIES (Woreda Isolated)
-- ==========================================

CREATE POLICY "Woreda Isolation: Applications access" ON applications
FOR ALL TO authenticated
USING (
    public.m_role() = 'Admin'
    OR 
    woreda_id = public.m_woreda_id()
)
WITH CHECK (
    public.m_role() = 'Admin'
    OR 
    woreda_id = public.m_woreda_id()
);

-- ==========================================
-- 5.10 ACTIVITIES TABLE POLICIES (Woreda Isolated)
-- ==========================================

CREATE POLICY "Woreda Isolation: Activities access" ON activities
FOR ALL TO authenticated
USING (
    public.m_role() = 'Admin'
    OR 
    woreda_id = public.m_woreda_id()
)
WITH CHECK (
    public.m_role() = 'Admin'
    OR 
    woreda_id = public.m_woreda_id()
);

-- Everyone can see activities (for real-time feed)
CREATE POLICY "Activities viewable by all authenticated" ON activities
FOR SELECT TO authenticated
USING (true);

-- ==========================================
-- 5.11 WOREDAS TABLE POLICIES
-- ==========================================

-- All authenticated users can view woredas
CREATE POLICY "Woredas viewable by all authenticated" ON woredas
FOR SELECT TO authenticated
USING (true);

-- Only admins can modify woredas
CREATE POLICY "Only admins can modify woredas" ON woredas
FOR ALL TO authenticated
USING (public.m_role() = 'Admin')
WITH CHECK (public.m_role() = 'Admin');

-- ==========================================
-- 6. CLEANUP OLD FUNCTIONS (Optional)
-- ==========================================

-- We no longer need the slow get_user_role() function
-- DROP FUNCTION IF EXISTS get_user_role(); -- Keep if needed for backward compatibility

-- ==========================================
-- 7. VERIFICATION QUERIES (Run these to check)
-- ==========================================

/*

-- Check active policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
ORDER BY tablename, policyname;

-- Test REAL-TIME helper functions (run when logged in)
SELECT public.m_role();
SELECT public.m_woreda_id();

-- Check RLS enabled
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'users';

-- Test trigger: Update a user and check metadata sync
UPDATE public.users SET role = 'TestRole' WHERE id = auth.uid();
SELECT raw_app_metadata->'role' FROM auth.users WHERE id = auth.uid();

-- Bulk sync all users metadata (run once if needed)
UPDATE auth.users 
SET raw_app_metadata = COALESCE(raw_app_metadata, '{}'::jsonb) || 
  jsonb_build_object(
    'role', (SELECT role FROM public.users WHERE id = auth.users.id), 
    'woreda_id', (SELECT woreda_id FROM public.users WHERE id = auth.users.id)
  ) 
WHERE id IN (SELECT id FROM public.users);

*/
