-- ==========================================
-- 1. NUCLEAR RESET (Clear the slate)
-- ==========================================
DROP TABLE IF EXISTS audit_logs, system_fees, violations, drivers, vehicles, plates, payments, users, applications, alerts, activities CASCADE;
DROP FUNCTION IF EXISTS trigger_set_timestamp, get_user_role CASCADE;

-- ==========================================
-- 2. SETUP EXTENSIONS & FUNCTIONS
-- ==========================================
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions; -- Added for fast case-insensitive search

-- Standard function to auto-update 'updated_at' columns
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ==========================================
-- 3. CREATE TABLES (Pure Supabase Schema)
-- ==========================================
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    password TEXT, 
    role TEXT NOT NULL DEFAULT 'Clerk',
    name TEXT, 
    email TEXT,
    status TEXT DEFAULT 'Active',
    can_access_web BOOLEAN DEFAULT TRUE,
    can_access_mobile BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper function to get current user role without recursion
-- Optimized with SECURITY DEFINER and STABLE to allow caching
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = (SELECT auth.uid());
$$ LANGUAGE sql 
SECURITY DEFINER 
STABLE
SET search_path = public;

CREATE TABLE vehicles (
    id TEXT PRIMARY KEY DEFAULT ('VEH-' || upper(substring(md5(random()::text) from 1 for 9))), 
    plate_number TEXT UNIQUE NOT NULL,
    make TEXT,
    model TEXT,
    year INTEGER,
    type TEXT, 
    owner_name TEXT,
    owner_phone TEXT,
    status TEXT DEFAULT 'Active',
    expiry_date TIMESTAMPTZ, 
    stolen_status JSONB DEFAULT '{"isStolen": false}',
    address TEXT,
    national_id TEXT,
    chassis_number TEXT,
    engine_number TEXT,
    color TEXT,
    fuel_type TEXT,
    deleted_at TIMESTAMPTZ, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE drivers (
    id TEXT PRIMARY KEY DEFAULT ('DRV-' || upper(substring(md5(random()::text) from 1 for 9))), 
    license_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT, 
    gender TEXT, 
    status TEXT DEFAULT 'Active',
    expiry_date TIMESTAMPTZ, 
    associated_vehicles JSONB DEFAULT '[]', 
    deleted_at TIMESTAMPTZ, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    violation_type TEXT NOT NULL,
    driver_name TEXT,
    license_number TEXT, 
    plate_number TEXT,
    amount NUMERIC NOT NULL,
    amount_paid NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Unpaid',
    payment_history JSONB DEFAULT '[]',
    deleted_at TIMESTAMPTZ, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number TEXT UNIQUE NOT NULL,
    type TEXT, 
    status TEXT DEFAULT 'Available',
    assigned_to TEXT,
    notes TEXT, 
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text, 
    payer_name TEXT, 
    service_type TEXT, 
    amount NUMERIC NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(), 
    payment_method TEXT,
    reference_number TEXT,
    status TEXT,
    notes TEXT, 
    violation_id UUID REFERENCES violations(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user" TEXT, 
    role TEXT, 
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT, 
    status TEXT, 
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE applications (
    id TEXT PRIMARY KEY DEFAULT ('APP-' || upper(substring(md5(random()::text) from 1 for 9))), 
    type TEXT,
    status TEXT DEFAULT 'Pending',
    applicant_name TEXT,
    first_name TEXT, 
    last_name TEXT, 
    gender TEXT, 
    phone TEXT, 
    details JSONB DEFAULT '{}', 
    deleted_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL, 
    type TEXT, 
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'Low', 
    location TEXT,
    metadata JSONB DEFAULT '{}', 
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    target TEXT NOT NULL,
    icon TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. APPLY TIMESTAMPS TRIGGERS
-- ==========================================
CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_vehicles BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_drivers BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_violations BEFORE UPDATE ON violations FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_plates BEFORE UPDATE ON plates FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_applications BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_alerts BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_activities BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE plates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Enable Realtime for activities
-- Create the publication if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE activities;
ALTER PUBLICATION supabase_realtime ADD TABLE violations;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;

-- 5.1 Users Table Policies
-- Allow anonymous users to look up their email by username for the login flow
CREATE POLICY "Allow anonymous username lookup" ON users 
FOR SELECT TO anon 
USING (status = 'Active');

-- Consolidated policies for efficiency (Avoid multiple permissive policies)
CREATE POLICY "Enable SELECT for authenticated users" ON users 
FOR SELECT TO authenticated 
USING (true);

CREATE POLICY "Enable INSERT for authenticated users" ON users 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- Allow authenticated users to update their own records or Admins to update any
CREATE POLICY "Users can update own record or Admins update any" ON users 
FOR UPDATE TO authenticated 
USING (
    (SELECT auth.uid()) = id 
    OR 
    (SELECT get_user_role()) = 'Admin'
)
WITH CHECK (
    (SELECT auth.uid()) = id 
    OR 
    (SELECT get_user_role()) = 'Admin'
);

-- Admins have full access (DELETE and others)
CREATE POLICY "Admins have DELETE access" ON users 
FOR DELETE TO authenticated 
USING ((SELECT get_user_role()) = 'Admin');

-- 5.2 Operational Data Policies (Clerks, Officers & Admins get full access)
-- Drop the catch-all debug policy 
DROP POLICY IF EXISTS "TEMP DEBUG - Allow All Vehicle Actions" ON vehicles; 

-- Create explicit policies for all operations 
CREATE POLICY "Enable all for authenticated users" 
ON vehicles FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true); 

-- Secure anonymous access (Read only for public/anonymous)
CREATE POLICY "Enable read for anon" 
ON vehicles FOR SELECT 
TO anon 
USING (status = 'Active');


-- Operational policies for Clerks, Officers and Admins
CREATE POLICY "Operational access for Clerks, Officers and Admins" ON drivers FOR ALL TO authenticated
USING ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON violations FOR ALL TO authenticated
USING ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON plates FOR ALL TO authenticated
USING ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON payments FOR ALL TO authenticated
USING ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON audit_logs FOR ALL TO authenticated
USING ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON applications FOR ALL TO authenticated
USING ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON alerts FOR ALL TO authenticated
USING ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON activities FOR ALL TO authenticated
USING ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK ((SELECT get_user_role()) IN ('Admin', 'Clerk', 'Officer'));

-- ==========================================
-- 6. RECALCULATE STATISTICS (The Fix for Culprit A)
-- ==========================================
ANALYZE users;
ANALYZE vehicles;
ANALYZE violations;
ANALYZE drivers;
ANALYZE plates;
ANALYZE payments;
ANALYZE alerts;
ANALYZE activities;

-- ==========================================
-- 7. INDEXES & PERFORMANCE OPTIMIZATIONS
-- ==========================================

-- Cover foreign keys to avoid full table scans on joins
CREATE INDEX IF NOT EXISTS idx_payments_violation_id ON payments(violation_id);

-- Vehicles table indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON vehicles(plate_number); -- Standard B-tree for direct = match (FASTEST)
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number_trgm ON vehicles USING gin (plate_number gin_trgm_ops); -- GIN for search (.ilike)
CREATE INDEX IF NOT EXISTS idx_vehicles_owner_name ON vehicles(owner_name); 
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status); 
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted ON vehicles(deleted_at) WHERE deleted_at IS NULL; 

-- Violations table indexes (most frequently queried) 
CREATE INDEX IF NOT EXISTS idx_violations_plate_number ON violations(plate_number); -- Standard B-tree for Joins
CREATE INDEX IF NOT EXISTS idx_violations_plate_number_trgm ON violations USING gin (plate_number gin_trgm_ops); -- GIN for Search
CREATE INDEX IF NOT EXISTS idx_violations_license_number ON violations(license_number); -- Added missing FK-like index
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status); 
CREATE INDEX IF NOT EXISTS idx_violations_created ON violations(created_at DESC); 
CREATE INDEX IF NOT EXISTS idx_violations_composite ON violations(plate_number, status, created_at); 

-- Drivers table indexes
CREATE INDEX IF NOT EXISTS idx_drivers_license_number ON drivers(license_number); -- Standard B-tree for direct = match
CREATE INDEX IF NOT EXISTS idx_drivers_license_number_trgm ON drivers USING gin (license_number gin_trgm_ops); -- GIN for Search
CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers(phone); 
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status); 

-- Activities table (for recent scans) 
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC); 
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type); 

-- Users table (Optimized for Auth lookups)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Timestamps for PowerSync sync windows
CREATE INDEX IF NOT EXISTS idx_vehicles_updated ON vehicles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_violations_updated ON violations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);

-- Optimize table for PowerSync sync frequency 
-- Add last_sync tracking (helps with debugging sync issues) 
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ; 
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ; 
ALTER TABLE violations ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ; 

-- View for common officer queries
-- Optimized with security_invoker = on for Supabase security compliance
CREATE OR REPLACE VIEW officer_vehicle_summary 
WITH (security_invoker = on) AS 
SELECT 
    v.plate_number, 
    v.make, 
    v.model, 
    v.color, 
    v.status as vehicle_status, 
    v.owner_name, 
    v.owner_phone, 
    COUNT(DISTINCT vio.id) FILTER (WHERE vio.status = 'Unpaid'::text OR vio.status = 'PENDING'::text) as unpaid_violations, 
    COALESCE(SUM(vio.amount) FILTER (WHERE vio.status = 'Unpaid'::text OR vio.status = 'PENDING'::text), 0::numeric) as total_unpaid, 
    MAX(vio.created_at) as last_violation_date 
FROM vehicles v 
LEFT JOIN violations vio ON v.plate_number = vio.plate_number AND vio.deleted_at IS NULL 
WHERE v.deleted_at IS NULL 
GROUP BY v.id, v.plate_number, v.make, v.model, v.color, v.status, v.owner_name, v.owner_phone;

-- ==========================================
-- 7. POWERSYNC INTEGRATION
-- ==========================================

-- 1. Refresh the Publication
-- This tells PowerSync which tables to stream to your offline clients.
-- Important: PowerSync requires all tables mentioned in your Sync Rules to be in this publication.
DROP PUBLICATION IF EXISTS powersync;
CREATE PUBLICATION powersync FOR TABLE 
    users,
    vehicles, 
    drivers, 
    violations, 
    plates, 
    alerts, 
    payments;

-- 2. Enable REPLICA IDENTITY FULL
-- Crucial for PowerSync to correctly identify and sync row updates/deletes.
ALTER TABLE users REPLICA IDENTITY FULL;
ALTER TABLE vehicles REPLICA IDENTITY FULL;
ALTER TABLE drivers REPLICA IDENTITY FULL;
ALTER TABLE violations REPLICA IDENTITY FULL;
ALTER TABLE plates REPLICA IDENTITY FULL;
ALTER TABLE alerts REPLICA IDENTITY FULL;
ALTER TABLE payments REPLICA IDENTITY FULL;

-- ==========================================
-- 8. INITIAL DATA (Optional)
-- ==========================================
-- Example: Create an initial admin user record in the public.users table.
-- NOTE: You must ALSO create this user in Supabase Auth (auth.users) with the same email.
/*
INSERT INTO users (username, email, role, name, status, can_access_web)
VALUES ('admin', 'admin@example.com', 'Admin', 'System Administrator', 'Active', TRUE);
*/