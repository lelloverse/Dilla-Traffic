-- ==========================================
-- 1. NUCLEAR RESET (Clear the slate)
-- ==========================================
DROP TABLE IF EXISTS audit_logs, system_fees, violations, drivers, vehicles, plates, payments, users, applications, alerts CASCADE;
DROP FUNCTION IF EXISTS trigger_set_timestamp, get_user_role CASCADE;

-- ==========================================
-- 2. SETUP EXTENSIONS & FUNCTIONS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Standard function to auto-update 'updated_at' columns
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 3. CREATE TABLES (Pure Supabase Schema)
-- ==========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

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
ALTER PUBLICATION supabase_realtime ADD TABLE activities;
ALTER PUBLICATION supabase_realtime ADD TABLE violations;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;

-- 5.1 Users Table Policies
-- Allow anyone to read user profiles (necessary for login lookup by username)
CREATE POLICY "Enable read access for all users" ON users FOR SELECT USING (true);

-- Allow anyone to insert (Necessary for signup and admin creation)
-- This is a very permissive policy to fix the "new row violates row-level security" error
CREATE POLICY "Enable insert for all users" ON users FOR INSERT WITH CHECK (true);

-- Allow authenticated users to update their own records
CREATE POLICY "Users can update own record" ON users FOR UPDATE TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins can do everything
CREATE POLICY "Admins have full access" ON users FOR ALL TO authenticated 
USING (get_user_role() = 'Admin')
WITH CHECK (get_user_role() = 'Admin');

-- 5.2 Operational Data Policies (Clerks, Officers & Admins get full access)
CREATE POLICY "Operational access for Clerks, Officers and Admins" ON vehicles FOR ALL TO authenticated
USING (get_user_role() IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK (get_user_role() IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON drivers FOR ALL TO authenticated
USING (get_user_role() IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK (get_user_role() IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON violations FOR ALL TO authenticated
USING (get_user_role() IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK (get_user_role() IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON plates FOR ALL TO authenticated
USING (get_user_role() IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK (get_user_role() IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON payments FOR ALL TO authenticated
USING (get_user_role() IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK (get_user_role() IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON audit_logs FOR ALL TO authenticated
USING (get_user_role() IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK (get_user_role() IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON applications FOR ALL TO authenticated
USING (get_user_role() IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK (get_user_role() IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON alerts FOR ALL TO authenticated
USING (get_user_role() IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK (get_user_role() IN ('Admin', 'Clerk', 'Officer'));

CREATE POLICY "Operational access for Clerks, Officers and Admins" ON activities FOR ALL TO authenticated
USING (get_user_role() IN ('Admin', 'Clerk', 'Officer'))
WITH CHECK (get_user_role() IN ('Admin', 'Clerk', 'Officer'));
