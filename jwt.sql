-- ==========================================
-- ARCHITECTURAL SHIFT: JWT-BASED RLS POLICIES
-- ==========================================

-- 1. DROP OLD POLICIES & FUNCTIONS
-- These functions use get_user_role() which is slow (row-level lookup)
DROP POLICY IF EXISTS "Enable SELECT for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable INSERT for authenticated users" ON users;
DROP POLICY IF EXISTS "Users can update own record or Admins update any" ON users;
DROP POLICY IF EXISTS "Admins have DELETE access" ON users;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON vehicles;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON drivers;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON violations;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON plates;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON payments;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON audit_logs;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON applications;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON alerts;
DROP POLICY IF EXISTS "Operational access for Clerks, Officers and Admins" ON activities;

-- DROP NEW JWT POLICIES (to allow script re-runs)
DROP POLICY IF EXISTS "JWT: Admins have full access to users" ON users;
DROP POLICY IF EXISTS "JWT: Users can insert their own record" ON users;
DROP POLICY IF EXISTS "JWT: Users can view all users" ON users;
DROP POLICY IF EXISTS "JWT: Users can update own record" ON users;
DROP POLICY IF EXISTS "JWT: Admins/Officers/Clerks have full access to vehicles" ON vehicles;
DROP POLICY IF EXISTS "JWT: Admins/Officers/Clerks have full access to drivers" ON drivers;
DROP POLICY IF EXISTS "JWT: Admins/Officers/Clerks have full access to violations" ON violations;
DROP POLICY IF EXISTS "JWT: Admins/Officers/Clerks have full access to plates" ON plates;
DROP POLICY IF EXISTS "JWT: Admins/Officers/Clerks have full access to payments" ON payments;
DROP POLICY IF EXISTS "JWT: Admins/Officers/Clerks have full access to alerts" ON alerts;
DROP POLICY IF EXISTS "JWT: Admins/Officers/Clerks have full access to activities" ON activities;
DROP POLICY IF EXISTS "JWT: Admins/Officers/Clerks have full access to audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "JWT: Admins/Officers/Clerks have full access to applications" ON applications;

-- 2. CREATE ROLE SYNC TRIGGER
-- This ensures that when public.users.role changes, it's synced to Supabase Auth metadata
-- This is the fallback if the Auth Hook isn't used, and it's good for redundancy.
CREATE OR REPLACE FUNCTION sync_user_role_to_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS on_user_role_change ON users;
CREATE TRIGGER on_user_role_change
  AFTER UPDATE OF role OR INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION sync_user_role_to_metadata();

-- 3. NEW JWT-BASED POLICIES
-- High performance: No database lookups during policy evaluation.
-- Uses (auth.jwt() -> 'app_metadata' ->> 'role') directly.
-- Wrapped in (SELECT ...) to fix Auth RLS Initialization Plan warnings.

-- USERS TABLE
CREATE POLICY "JWT: Admins have full access to users" ON users
FOR ALL TO authenticated
USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'Admin')
WITH CHECK (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'Admin');

-- Allow users to insert their own record during the signUp flow
CREATE POLICY "JWT: Users can insert their own record" ON users
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "JWT: Users can view all users" ON users
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "JWT: Users can update own record" ON users
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);

-- VEHICLES TABLE
CREATE POLICY "JWT: Admins/Officers/Clerks have full access to vehicles" ON vehicles
FOR ALL TO authenticated
USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('Admin', 'Officer', 'Clerk'));

-- DRIVERS TABLE
CREATE POLICY "JWT: Admins/Officers/Clerks have full access to drivers" ON drivers
FOR ALL TO authenticated
USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('Admin', 'Officer', 'Clerk'));

-- VIOLATIONS TABLE
CREATE POLICY "JWT: Admins/Officers/Clerks have full access to violations" ON violations
FOR ALL TO authenticated
USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('Admin', 'Officer', 'Clerk'));

-- PLATES TABLE
CREATE POLICY "JWT: Admins/Officers/Clerks have full access to plates" ON plates
FOR ALL TO authenticated
USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('Admin', 'Officer', 'Clerk'));

-- PAYMENTS TABLE
CREATE POLICY "JWT: Admins/Officers/Clerks have full access to payments" ON payments
FOR ALL TO authenticated
USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('Admin', 'Officer', 'Clerk'));

-- ALERTS TABLE
CREATE POLICY "JWT: Admins/Officers/Clerks have full access to alerts" ON alerts
FOR ALL TO authenticated
USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('Admin', 'Officer', 'Clerk'));

-- ACTIVITIES TABLE
CREATE POLICY "JWT: Admins/Officers/Clerks have full access to activities" ON activities
FOR ALL TO authenticated
USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('Admin', 'Officer', 'Clerk'));

-- AUDIT LOGS TABLE
CREATE POLICY "JWT: Admins/Officers/Clerks have full access to audit_logs" ON audit_logs
FOR ALL TO authenticated
USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('Admin', 'Officer', 'Clerk'));

-- APPLICATIONS TABLE
CREATE POLICY "JWT: Admins/Officers/Clerks have full access to applications" ON applications
FOR ALL TO authenticated
USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('Admin', 'Officer', 'Clerk'));

-- 4. CLEANUP
-- We no longer need the slow get_user_role() function
-- DROP FUNCTION IF EXISTS get_user_role(); -- Keep it for now just in case of edge cases in other views
