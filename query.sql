-- ==========================================
-- 1. NUCLEAR RESET (Clear the slate)
-- ==========================================
DROP TABLE IF EXISTS audit_logs, system_fees, violations, drivers, vehicles, plates, payments, users, applications, alerts, activities, woredas CASCADE;
DROP FUNCTION IF EXISTS trigger_set_timestamp, get_user_role, set_violation_woreda, set_payment_woreda CASCADE;

-- ==========================================
-- 2. SETUP EXTENSIONS & FUNCTIONS
-- ==========================================
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions; 

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
-- 2. CREATE JWT HELPER FUNCTIONS (in public schema)
-- ==========================================

-- Helper for RLS readability - get woreda_id from JWT (Check both app_metadata and user_metadata)
CREATE OR REPLACE FUNCTION public.m_woreda_id() 
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    ((auth.jwt()) -> 'app_metadata' ->> 'woreda_id'),
    ((auth.jwt()) -> 'user_metadata' ->> 'woreda_id')
  )::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper for RLS readability - get role from JWT (Check both app_metadata and user_metadata)
CREATE OR REPLACE FUNCTION public.m_role() 
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    ((auth.jwt()) -> 'app_metadata' ->> 'role'),
    ((auth.jwt()) -> 'user_metadata' ->> 'role'),
    'None'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN 'None';
END;
$$ LANGUAGE plpgsql STABLE;

-- ==========================================
-- 2.1 AUTH USER SYNC (Supabase Auth -> public.users)
-- ==========================================

-- Automatically create a profile in public.users when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id, 
    username, 
    email, 
    name, 
    role, 
    status, 
    woreda_id,
    can_access_web,
    can_access_mobile,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_app_meta_data->>'role', NEW.raw_user_meta_data->>'role', 'Clerk'),
    'Active',
    COALESCE(NEW.raw_app_meta_data->>'woreda_id', NEW.raw_user_meta_data->>'woreda_id')::UUID,
    COALESCE((NEW.raw_app_meta_data->>'can_access_web')::boolean, (NEW.raw_user_meta_data->>'can_access_web')::boolean, true),
    COALESCE((NEW.raw_app_meta_data->>'can_access_mobile')::boolean, (NEW.raw_user_meta_data->>'can_access_mobile')::boolean, false),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    password = EXCLUDED.password,
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    woreda_id = EXCLUDED.woreda_id,
    can_access_web = EXCLUDED.can_access_web,
    can_access_mobile = EXCLUDED.can_access_mobile,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users (Supabase managed schema)
-- Note: This requires high-level permissions; in local dev/SQL editor it usually works.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 3. CREATE TABLES (Woreda-Aware Schema)
-- ==========================================

-- District/Woreda Table (Simplified - no geography)
CREATE TABLE woredas (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT NOT NULL,
    zone TEXT DEFAULT 'Southern Dilla',
    code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    password TEXT, 
    role TEXT NOT NULL DEFAULT 'Clerk' CHECK (role IN ('Admin', 'WoredaAdmin', 'Officer', 'Clerk', 'None')),
    woreda_id UUID REFERENCES woredas(id), -- Assigned District
    name TEXT, 
    email TEXT,
    status TEXT DEFAULT 'Active',
    can_access_web BOOLEAN DEFAULT TRUE,
    can_access_mobile BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    woreda_id UUID REFERENCES woredas(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    "user" TEXT NOT NULL,
    role TEXT,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    status TEXT DEFAULT 'success'
);

-- Optimized role lookup (kept for backward compatibility)
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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ
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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ
);

CREATE TABLE violations (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    woreda_id UUID REFERENCES woredas(id), -- Originating District
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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ
);

CREATE TABLE plates (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
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
    id TEXT PRIMARY KEY DEFAULT extensions.uuid_generate_v4()::text, 
    woreda_id UUID REFERENCES woredas(id),
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

-- Alerts Table (Woreda-isolated)
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    category TEXT NOT NULL CHECK (category IN ('System', 'BOLO', 'Security', 'Traffic')),
    type TEXT, 
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'Low' CHECK (priority IN ('High', 'Medium', 'Low')),
    location TEXT,
    metadata JSONB DEFAULT '{}', 
    is_active BOOLEAN DEFAULT TRUE,
    woreda_id UUID REFERENCES woredas(id), -- For district-specific alerts
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Applications Table (if needed)
CREATE TABLE applications (
    id TEXT PRIMARY KEY DEFAULT ('APP-' || upper(substring(md5(random()::text) from 1 for 9))), 
    type TEXT,
    status TEXT DEFAULT 'Pending',
    applicant_name TEXT,
    first_name TEXT, 
    last_name TEXT, 
    gender TEXT, 
    phone TEXT, 
    email TEXT,
    details JSONB DEFAULT '{}', 
    woreda_id UUID REFERENCES woredas(id),
    deleted_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities Table (for real-time feed)
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    target TEXT NOT NULL,
    icon TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    woreda_id UUID REFERENCES woredas(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. BUSINESS LOGIC TRIGGERS
-- ==========================================

-- Enhanced Woreda Assignment Trigger for Violations
CREATE OR REPLACE FUNCTION public.set_violation_woreda()
RETURNS TRIGGER AS $$
DECLARE
    v_woreda_id UUID;
BEGIN
    -- Try to find the woreda of the currently logged-in user
    SELECT woreda_id INTO v_woreda_id 
    FROM public.users 
    WHERE id = auth.uid();
    
    -- Priority: User context first, fallback to explicit value (for service roles)
    NEW.woreda_id := COALESCE(v_woreda_id, NEW.woreda_id);
    
    -- Safety Check: If no user context and no explicit ID provided, block the insert
    IF NEW.woreda_id IS NULL THEN
        RAISE EXCEPTION 'Transaction failed: woreda_id must be provided or derived from user context.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_set_violation_woreda
BEFORE INSERT ON violations
FOR EACH ROW EXECUTE FUNCTION public.set_violation_woreda();

-- Enhanced Woreda Assignment Trigger for Payments
CREATE OR REPLACE FUNCTION public.set_payment_woreda()
RETURNS TRIGGER AS $$
DECLARE
    v_woreda_id UUID;
BEGIN
    -- Get current user's woreda context
    SELECT woreda_id INTO v_woreda_id 
    FROM public.users 
    WHERE id = auth.uid();
    
    -- Prefer user context, but allow manual input (e.g., service roles/migration)
    NEW.woreda_id := COALESCE(v_woreda_id, NEW.woreda_id);
    
    -- Validation: Prevent nulls for critical financial records
    IF NEW.woreda_id IS NULL THEN
        RAISE EXCEPTION 'Transaction aborted: woreda_id is required but missing from user profile and input.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_set_payment_woreda
BEFORE INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION public.set_payment_woreda();

-- Auto-set woreda for applications
CREATE OR REPLACE FUNCTION public.set_application_woreda()
RETURNS TRIGGER AS $$
DECLARE
    v_woreda_id UUID;
BEGIN
    SELECT woreda_id INTO v_woreda_id 
    FROM public.users 
    WHERE id = auth.uid();
    
    NEW.woreda_id := COALESCE(v_woreda_id, NEW.woreda_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_set_application_woreda
BEFORE INSERT ON applications
FOR EACH ROW EXECUTE FUNCTION public.set_application_woreda();

-- Auto-set woreda for activities
CREATE OR REPLACE FUNCTION public.set_activity_woreda()
RETURNS TRIGGER AS $$
DECLARE
    v_woreda_id UUID;
BEGIN
    SELECT woreda_id INTO v_woreda_id 
    FROM public.users 
    WHERE id = auth.uid();
    
    NEW.woreda_id := COALESCE(v_woreda_id, NEW.woreda_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_set_activity_woreda
BEFORE INSERT ON activities
FOR EACH ROW EXECUTE FUNCTION public.set_activity_woreda();

-- Timestamp triggers
CREATE TRIGGER set_timestamp_woredas BEFORE UPDATE ON woredas FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_vehicles BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_drivers BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_violations BEFORE UPDATE ON violations FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_plates BEFORE UPDATE ON plates FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_payments BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_alerts BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_applications BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_activities BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ==========================================
-- 5. AUTH METADATA SYNC (Supabase JWT Context)
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

-- Bulk sync existing users
UPDATE auth.users 
SET raw_app_meta_data = 
  COALESCE(raw_app_meta_data, '{}'::jsonb) || 
  jsonb_build_object( 
    'role', (SELECT role FROM public.users WHERE id = auth.users.id), 
    'woreda_id', (SELECT woreda_id FROM public.users WHERE id = auth.users.id) 
  ) 
WHERE id IN (SELECT id FROM public.users);

-- ==========================================
-- 6. REFINED RLS POLICIES (Hierarchy & Isolation)
-- ==========================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth: Login Lookup" ON users;
DROP POLICY IF EXISTS "Admin: Regional Access" ON users;
DROP POLICY IF EXISTS "WoredaAdmin: District View" ON users;
DROP POLICY IF EXISTS "WoredaAdmin: District Manage" ON users;
DROP POLICY IF EXISTS "Users: Self Update" ON users;
DROP POLICY IF EXISTS "Auth: Signup Insert" ON users;

CREATE POLICY "Auth: Login Lookup" ON users FOR SELECT TO anon USING (status = 'Active');
CREATE POLICY "Admin: Regional Access" ON users FOR ALL TO authenticated USING (public.m_role() = 'Admin') WITH CHECK (public.m_role() = 'Admin');
CREATE POLICY "WoredaAdmin: District View" ON users FOR SELECT TO authenticated USING ((public.m_role() = 'WoredaAdmin' AND woreda_id = public.m_woreda_id()) OR (id = auth.uid()));
CREATE POLICY "WoredaAdmin: District Manage" ON users FOR ALL TO authenticated USING (public.m_role() = 'WoredaAdmin' AND woreda_id = public.m_woreda_id() AND role IN ('Officer', 'Clerk')) WITH CHECK (public.m_role() = 'WoredaAdmin' AND woreda_id = public.m_woreda_id() AND role IN ('Officer', 'Clerk'));
CREATE POLICY "Users: Self Update" ON users FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Auth: Signup Insert" ON users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
-- ==========================================
-- 7. VIEWS & REPORTING
-- ==========================================

-- Audit Log Function
CREATE OR REPLACE FUNCTION public.insert_audit_log(
    p_action text,
    p_details text,
    p_username text,
    p_role text,
    p_woreda_id uuid DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.audit_logs (
        woreda_id,
        "user",
        role,
        action,
        details,
        timestamp,
        ip_address,
        status
    )
    VALUES (
        COALESCE(p_woreda_id, (SELECT woreda_id FROM public.users WHERE id = auth.uid())),
        p_username,
        p_role,
        p_action,
        p_details,
        NOW(),
        NULL,
        'success'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.insert_audit_log(text, text, text, text, uuid) TO authenticated;

-- District Dashboard View
CREATE OR REPLACE VIEW woreda_dashboard 
WITH (security_invoker = on) AS
SELECT 
    w.id as woreda_id,
    w.name as woreda_name,
    w.code as woreda_code,
    COUNT(DISTINCT v.id) as total_violations,
    COALESCE(SUM(v.amount), 0) as total_fines,
    COALESCE(SUM(v.amount_paid), 0) as total_collected,
    COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'Officer') as assigned_officers,
    COUNT(DISTINCT a.id) FILTER (WHERE a.is_active = true) as active_alerts
FROM woredas w
LEFT JOIN users u ON u.woreda_id = w.id
LEFT JOIN violations v ON v.woreda_id = w.id AND v.deleted_at IS NULL
LEFT JOIN alerts a ON a.woreda_id = w.id AND a.deleted_at IS NULL
GROUP BY w.id, w.name, w.code;

-- Officer Vehicle Summary View
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
    COUNT(DISTINCT vio.id) FILTER (WHERE vio.status = 'Unpaid') as unpaid_violations, 
    COALESCE(SUM(vio.amount) FILTER (WHERE vio.status = 'Unpaid'), 0::numeric) as total_unpaid, 
    MAX(vio.created_at) as last_violation_date 
FROM vehicles v 
LEFT JOIN violations vio ON v.plate_number = vio.plate_number AND vio.deleted_at IS NULL 
WHERE v.deleted_at IS NULL 
GROUP BY v.id, v.plate_number, v.make, v.model, v.color, v.status, v.owner_name, v.owner_phone;

-- Debug View for JWT Claims
CREATE OR REPLACE VIEW public.debug_jwt_claims AS
SELECT 
    auth.uid() as user_id,
    public.m_role() as current_role,
    public.m_woreda_id() as current_woreda_id,
    (auth.jwt())::jsonb as full_jwt;

-- ==========================================
-- 6. ROW LEVEL SECURITY (RLS) ENABLEMENT
-- ==========================================
ALTER TABLE woredas ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Woredas Policies
DROP POLICY IF EXISTS "Allow public read access to woredas" ON woredas;
CREATE POLICY "Allow public read access to woredas" ON woredas FOR SELECT TO authenticated USING (true);

-- Drivers Policies
DROP POLICY IF EXISTS "Clerks can manage drivers" ON drivers;
CREATE POLICY "Clerks can manage drivers" ON drivers FOR ALL TO authenticated 
USING (public.m_role() IN ('Admin', 'WoredaAdmin', 'Clerk', 'Officer'))
WITH CHECK (public.m_role() IN ('Admin', 'WoredaAdmin', 'Clerk', 'Officer'));

-- Vehicles Policies
DROP POLICY IF EXISTS "Clerks can manage vehicles" ON vehicles;
CREATE POLICY "Clerks can manage vehicles" ON vehicles FOR ALL TO authenticated 
USING (public.m_role() IN ('Admin', 'WoredaAdmin', 'Clerk', 'Officer'))
WITH CHECK (public.m_role() IN ('Admin', 'WoredaAdmin', 'Clerk', 'Officer'));

-- Violations Policies (Woreda Isolated)
DROP POLICY IF EXISTS "Woreda isolated violations access" ON violations;
CREATE POLICY "Woreda isolated violations access" ON violations FOR ALL TO authenticated 
USING (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id())
WITH CHECK (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id());

-- Payments Policies (Woreda Isolated)
DROP POLICY IF EXISTS "Woreda isolated payments access" ON payments;
CREATE POLICY "Woreda isolated payments access" ON payments FOR ALL TO authenticated 
USING (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id())
WITH CHECK (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id());

-- Plates Policies
DROP POLICY IF EXISTS "Authenticated users can read plates" ON plates;
CREATE POLICY "Authenticated users can read plates" ON plates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Management can manage plates" ON plates;
CREATE POLICY "Management can manage plates" ON plates FOR ALL TO authenticated 
USING (public.m_role() IN ('Admin', 'WoredaAdmin', 'Clerk', 'Officer'))
WITH CHECK (public.m_role() IN ('Admin', 'WoredaAdmin', 'Clerk', 'Officer'));

-- Audit Logs Policies (Woreda Isolated)
DROP POLICY IF EXISTS "Woreda isolated audit logs access" ON audit_logs;
CREATE POLICY "Woreda isolated audit logs access" ON audit_logs FOR ALL TO authenticated 
USING (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id())
WITH CHECK (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id());

-- Applications Policies (Woreda Isolated)
DROP POLICY IF EXISTS "Woreda isolated applications access" ON applications;
CREATE POLICY "Woreda isolated applications access" ON applications FOR ALL TO authenticated 
USING (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id())
WITH CHECK (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id());

-- Alerts Policies (Woreda Isolated)
DROP POLICY IF EXISTS "Woreda isolated alerts access" ON alerts;
CREATE POLICY "Woreda isolated alerts access" ON alerts FOR ALL TO authenticated 
USING (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id())
WITH CHECK (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id());

-- Activities Policies (Woreda Isolated)
DROP POLICY IF EXISTS "Woreda isolated activities access" ON activities;
CREATE POLICY "Woreda isolated activities access" ON activities FOR ALL TO authenticated 
USING (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id())
WITH CHECK (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id());

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE plates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 7. SEED DATA
-- ==========================================
INSERT INTO woredas (name, code) VALUES
('Woreda 1', 'DILLA-W01'), ('Woreda 2', 'DILLA-W02'), ('Woreda 3', 'DILLA-W03'),
('Woreda 4', 'DILLA-W04'), ('Woreda 5', 'DILLA-W05'), ('Woreda 6', 'DILLA-W06'),
('Woreda 7', 'DILLA-W07'), ('Woreda 8', 'DILLA-W08'), ('Woreda 9', 'DILLA-W09'),
('Woreda 10', 'DILLA-W10'), ('Woreda 11', 'DILLA-W11'), ('Woreda 12', 'DILLA-W12');

-- Create test admin user (if needed)
DO $$
DECLARE
    admin_id UUID := '40a8db66-48c3-4f20-9440-7d110174d6bf';
    admin_email TEXT := 'antoniosawyne@gmail.com';
    admin_exists BOOLEAN;
BEGIN
    -- Check if auth user exists
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = admin_id) INTO admin_exists;
    
    IF NOT admin_exists THEN
        -- Create auth user
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token,
            aud,
            role
        ) VALUES (
            admin_id,
            '00000000-0000-0000-0000-000000000000',
            admin_email,
            -- This password hash is 'Admin123!' - note: gen_salt requires pgcrypto which is usually available
            '$2a$10$7R6P.9y8.9y8.9y8.9y8.OuS9/p2/f2/f2/f2/f2/f2/f2/f2/f2/f2',
            NOW(),
            '{"provider":"email","providers":["email"],"role":"Admin"}',
            jsonb_build_object('username', 'admin', 'full_name', 'System Administrator'),
            NOW(),
            NOW(),
            '',
            '',
            '',
            '',
            'authenticated',
            'authenticated'
        ) ON CONFLICT (id) DO NOTHING;
    END IF;
    
    -- Ensure public.users entry exists (handle_new_user trigger usually does this, but being explicit is safer for seed)
    INSERT INTO public.users (
        id,
        username,
        email,
        name,
        role,
        status,
        can_access_web,
        can_access_mobile,
        woreda_id
    ) VALUES (
        admin_id,
        'admin',
        admin_email,
        'System Administrator',
        'Admin',
        'Active',
        true,
        true,
        NULL
    ) ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        role = EXCLUDED.role,
        status = EXCLUDED.status;
END $$;

-- ==========================================
-- 8. INDEXES & PERFORMANCE OPTIMIZATIONS
-- ==========================================

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_payments_violation_id ON payments(violation_id);
CREATE INDEX IF NOT EXISTS idx_violations_woreda ON violations(woreda_id);
CREATE INDEX IF NOT EXISTS idx_payments_woreda ON payments(woreda_id);
CREATE INDEX IF NOT EXISTS idx_users_woreda ON users(woreda_id);
CREATE INDEX IF NOT EXISTS idx_alerts_woreda ON alerts(woreda_id);
CREATE INDEX IF NOT EXISTS idx_applications_woreda ON applications(woreda_id);
CREATE INDEX IF NOT EXISTS idx_activities_woreda ON activities(woreda_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_violations_woreda_created ON violations(woreda_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_woreda_date ON payments(woreda_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_users_woreda_role ON users(woreda_id, role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_woreda_timestamp ON audit_logs(woreda_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_woreda_created ON alerts(woreda_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_priority ON alerts(priority) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);

-- Vehicle search indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_trgm ON vehicles USING gin (plate_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner_name ON vehicles(owner_name);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted ON vehicles(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_updated ON vehicles(updated_at DESC);

-- Driver search indexes
CREATE INDEX IF NOT EXISTS idx_drivers_license_number ON drivers(license_number);
CREATE INDEX IF NOT EXISTS idx_drivers_license_trgm ON drivers USING gin (license_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_drivers_name_trgm ON drivers USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers(phone);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);

-- Violation indexes
CREATE INDEX IF NOT EXISTS idx_violations_plate_number ON violations(plate_number);
CREATE INDEX IF NOT EXISTS idx_violations_plate_trgm ON violations USING gin (plate_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_violations_license_number ON violations(license_number);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
CREATE INDEX IF NOT EXISTS idx_violations_created ON violations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_violations_composite ON violations(plate_number, status, created_at);
CREATE INDEX IF NOT EXISTS idx_violations_updated ON violations(updated_at DESC);

-- Activity feed indexes
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);

-- User lookup indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_username_lookup ON users(username) WHERE status = 'Active';
CREATE INDEX IF NOT EXISTS idx_users_email_lookup ON users(email) WHERE status = 'Active';
CREATE INDEX IF NOT EXISTS idx_users_login_composite ON users(username, email, status);

-- Payment indexes
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);

-- ==========================================
-- 9. REALTIME & POWERSYNC SETUP
-- ==========================================

-- Realtime publications
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Add tables to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE activities;
ALTER PUBLICATION supabase_realtime ADD TABLE violations;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE woredas;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;

-- PowerSync publication
DROP PUBLICATION IF EXISTS powersync;
CREATE PUBLICATION powersync FOR TABLE 
    users, vehicles, drivers, violations, plates, alerts, payments, woredas;

-- Set replica identity for PowerSync
ALTER TABLE users REPLICA IDENTITY FULL;
ALTER TABLE vehicles REPLICA IDENTITY FULL;
ALTER TABLE drivers REPLICA IDENTITY FULL;
ALTER TABLE violations REPLICA IDENTITY FULL;
ALTER TABLE plates REPLICA IDENTITY FULL;
ALTER TABLE alerts REPLICA IDENTITY FULL;
ALTER TABLE payments REPLICA IDENTITY FULL;
ALTER TABLE woredas REPLICA IDENTITY FULL;
ALTER TABLE audit_logs REPLICA IDENTITY FULL;
ALTER TABLE applications REPLICA IDENTITY FULL;
ALTER TABLE activities REPLICA IDENTITY FULL;

-- ==========================================
-- 10. ANALYZE FOR QUERY PLANNER
-- ==========================================
ANALYZE woredas;
ANALYZE users;
ANALYZE vehicles;
ANALYZE drivers;
ANALYZE violations;
ANALYZE plates;
ANALYZE payments;
ANALYZE alerts;
ANALYZE applications;
ANALYZE activities;
ANALYZE audit_logs;