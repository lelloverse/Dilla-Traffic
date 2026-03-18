-- ==========================================
-- 1. NUCLEAR RESET & EXTENSIONS
-- ==========================================
DROP TABLE IF EXISTS audit_logs, system_fees, violations, drivers, vehicles, plates, payments, users, applications, alerts, activities, woredas CASCADE;
DROP FUNCTION IF EXISTS trigger_set_timestamp, get_user_role, set_violation_woreda, set_payment_woreda, public.m_woreda_id, public.m_role, public.handle_new_user, public.sync_user_to_auth CASCADE;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions; 

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- 2. JWT HELPER FUNCTIONS (The Source of Truth)
-- ==========================================
CREATE OR REPLACE FUNCTION public.m_woreda_id() 
RETURNS UUID AS $$
BEGIN
  RETURN ((auth.jwt()) -> 'app_metadata' ->> 'woreda_id')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.m_role() 
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(((auth.jwt()) -> 'app_metadata' ->> 'role'), 'None');
EXCEPTION WHEN OTHERS THEN
  RETURN 'None';
END;
$$ LANGUAGE plpgsql STABLE;

-- ==========================================
-- 3. SCHEMA CREATION
-- ==========================================
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
    woreda_id UUID REFERENCES woredas(id),
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

-- Violations table with built-in date column for uniqueness
CREATE TABLE violations (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    woreda_id UUID REFERENCES woredas(id),
    violation_type TEXT NOT NULL,
    driver_name TEXT,
    license_number TEXT, 
    plate_number TEXT,
    amount NUMERIC NOT NULL,
    amount_paid NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Unpaid' CHECK (status IN ('Paid', 'Unpaid', 'Partial', 'Overdue')),
    payment_history JSONB DEFAULT '[]',
    violation_date DATE DEFAULT CURRENT_DATE,  -- Store date separately for uniqueness
    deleted_at TIMESTAMPTZ, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ
);

-- Unique constraint to prevent duplicate violations on the same day
CREATE UNIQUE INDEX idx_violations_unique_daily 
ON violations (plate_number, license_number, violation_type, violation_date) 
WHERE status IN ('Unpaid', 'Partial');

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

-- Payments table with receipt number
CREATE TABLE payments (
    id TEXT PRIMARY KEY DEFAULT extensions.uuid_generate_v4()::text, 
    woreda_id UUID REFERENCES woredas(id),
    payer_name TEXT, 
    service_type TEXT, 
    amount NUMERIC NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(), 
    payment_method TEXT,
    reference_number TEXT,  -- will be used as receipt number
    status TEXT,
    notes TEXT, 
    violation_id UUID REFERENCES violations(id),
    receipt_number TEXT UNIQUE,  -- auto-generated receipt number
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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
    woreda_id UUID REFERENCES woredas(id),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
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
    email TEXT,
    details JSONB DEFAULT '{}', 
    woreda_id UUID REFERENCES woredas(id),
    deleted_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
-- 4. TRIGGERS & BUSINESS LOGIC
-- ==========================================
-- Auto-set violation_date from created_at if not provided
CREATE OR REPLACE FUNCTION violations_set_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.violation_date IS NULL THEN
        NEW.violation_date := NEW.created_at::DATE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_violations_set_date
    BEFORE INSERT ON violations
    FOR EACH ROW
    EXECUTE FUNCTION violations_set_date();

-- Generate receipt number for payments
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER AS $$
DECLARE
    woreda_code TEXT;
    year_month TEXT;
    sequence_num INTEGER;
BEGIN
    SELECT code INTO woreda_code FROM woredas WHERE id = NEW.woreda_id;
    year_month := TO_CHAR(NOW(), 'YYYYMM');
    
    SELECT COALESCE(MAX(SUBSTRING(receipt_number FROM 'RCP-[A-Z0-9]+-[0-9]+-([0-9]+)$')::INTEGER), 0) + 1
    INTO sequence_num
    FROM payments
    WHERE woreda_id = NEW.woreda_id 
    AND receipt_number LIKE 'RCP-' || COALESCE(woreda_code, 'GEN') || '-' || year_month || '-%';
    
    NEW.receipt_number := 'RCP-' || COALESCE(woreda_code, 'GEN') || '-' || year_month || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    IF NEW.id IS NULL OR NEW.id = '' THEN
        NEW.id := extensions.uuid_generate_v4()::TEXT;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_generate_receipt_number
    BEFORE INSERT ON payments
    FOR EACH ROW
    WHEN (NEW.receipt_number IS NULL)
    EXECUTE FUNCTION generate_receipt_number();

-- Auth user sync triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, email, name, role, status, woreda_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_app_meta_data->>'role', 'Clerk'),
    'Active',
    (NEW.raw_app_meta_data->>'woreda_id')::UUID
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_user_to_auth() 
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ 
BEGIN 
  UPDATE auth.users SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role, 'woreda_id', NEW.woreda_id) WHERE id = NEW.id; 
  RETURN NEW; 
END; 
$$; 

CREATE TRIGGER sync_user_to_auth_trigger AFTER INSERT OR UPDATE OF role, woreda_id ON users FOR EACH ROW EXECUTE FUNCTION public.sync_user_to_auth(); 

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
-- 5. ROW LEVEL SECURITY POLICIES (Clean, Non-duplicate)
-- ==========================================
ALTER TABLE woredas ENABLE ROW LEVEL SECURITY;
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

-- USERS
CREATE POLICY "Auth: Login Lookup" ON users FOR SELECT TO anon USING (status = 'Active');
CREATE POLICY "Admin: Full Access" ON users FOR ALL TO authenticated USING (public.m_role() = 'Admin') WITH CHECK (public.m_role() = 'Admin');
CREATE POLICY "WoredaAdmin: District View" ON users FOR SELECT TO authenticated
USING (
    public.m_role() = 'Admin' 
    OR (public.m_role() = 'WoredaAdmin' AND woreda_id = public.m_woreda_id())
    OR id = auth.uid()
);
CREATE POLICY "WoredaAdmin: District Manage" ON users FOR ALL TO authenticated
USING (public.m_role() = 'WoredaAdmin' AND woreda_id = public.m_woreda_id() AND role IN ('Officer', 'Clerk'))
WITH CHECK (public.m_role() = 'WoredaAdmin' AND woreda_id = public.m_woreda_id() AND role IN ('Officer', 'Clerk'));
CREATE POLICY "Basic: Self View" ON users FOR SELECT TO authenticated USING (public.m_role() IN ('Officer', 'Clerk') AND id = auth.uid());
CREATE POLICY "Users: Self Update" ON users FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Auth: Signup Insert" ON users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- VIOLATIONS
CREATE POLICY "Violations: Access" ON violations FOR ALL TO authenticated
USING (
    public.m_role() = 'Admin' 
    OR (public.m_role() IN ('WoredaAdmin', 'Officer', 'Clerk') AND woreda_id = public.m_woreda_id())
)
WITH CHECK (
    public.m_role() = 'Admin' 
    OR (public.m_role() IN ('WoredaAdmin', 'Officer', 'Clerk') AND woreda_id = public.m_woreda_id())
);

-- PAYMENTS
CREATE POLICY "Payments: Admin Full Access" ON payments FOR ALL TO authenticated USING (public.m_role() = 'Admin') WITH CHECK (public.m_role() = 'Admin');
CREATE POLICY "Payments: Clerk Manage District" ON payments FOR ALL TO authenticated
USING (public.m_role() = 'Clerk' AND woreda_id = public.m_woreda_id())
WITH CHECK (public.m_role() = 'Clerk' AND woreda_id = public.m_woreda_id());
CREATE POLICY "Payments: WoredaAdmin Manage District" ON payments FOR ALL TO authenticated
USING (public.m_role() = 'WoredaAdmin' AND woreda_id = public.m_woreda_id())
WITH CHECK (public.m_role() = 'WoredaAdmin' AND woreda_id = public.m_woreda_id());
CREATE POLICY "Payments: Officer View District" ON payments FOR SELECT TO authenticated
USING (public.m_role() = 'Officer' AND woreda_id = public.m_woreda_id());
CREATE POLICY "Payments: Staff View Own District" ON payments FOR SELECT TO authenticated
USING (woreda_id = public.m_woreda_id() OR public.m_role() = 'Admin');

-- ALERTS
CREATE POLICY "Alerts: Admin Full Access" ON alerts FOR ALL TO authenticated USING (public.m_role() = 'Admin') WITH CHECK (public.m_role() = 'Admin');
CREATE POLICY "Alerts: Clerk Manage District" ON alerts FOR ALL TO authenticated
USING (public.m_role() = 'Clerk' AND woreda_id = public.m_woreda_id())
WITH CHECK (public.m_role() = 'Clerk' AND woreda_id = public.m_woreda_id());
CREATE POLICY "Alerts: WoredaAdmin Manage District" ON alerts FOR ALL TO authenticated
USING (public.m_role() = 'WoredaAdmin' AND woreda_id = public.m_woreda_id())
WITH CHECK (public.m_role() = 'WoredaAdmin' AND woreda_id = public.m_woreda_id());
CREATE POLICY "Alerts: Officer Manage District" ON alerts FOR ALL TO authenticated
USING (public.m_role() = 'Officer' AND woreda_id = public.m_woreda_id())
WITH CHECK (public.m_role() = 'Officer' AND woreda_id = public.m_woreda_id());
CREATE POLICY "Alerts: Staff View Active" ON alerts FOR SELECT TO authenticated
USING (is_active = true OR woreda_id = public.m_woreda_id() OR public.m_role() = 'Admin');
CREATE POLICY "Alerts: Anonymous View BOLO" ON alerts FOR SELECT TO anon
USING (is_active = true AND category = 'BOLO');

-- VEHICLES, DRIVERS, PLATES (Global access)
CREATE POLICY "Vehicles: Regional Access" ON vehicles FOR ALL TO authenticated USING (public.m_role() IN ('Admin', 'WoredaAdmin', 'Officer', 'Clerk'));
CREATE POLICY "Vehicles: Anonymous Lookup" ON vehicles FOR SELECT TO anon USING (status = 'Active' AND deleted_at IS NULL);
CREATE POLICY "Drivers: Regional Access" ON drivers FOR ALL TO authenticated USING (public.m_role() IN ('Admin', 'WoredaAdmin', 'Officer', 'Clerk'));
CREATE POLICY "Drivers: Anonymous Lookup" ON drivers FOR SELECT TO anon USING (status = 'Active' AND deleted_at IS NULL);
CREATE POLICY "Plates: Regional Access" ON plates FOR ALL TO authenticated USING (public.m_role() IN ('Admin', 'WoredaAdmin', 'Officer', 'Clerk'));

-- OTHER WOREDA-ISOLATED TABLES
CREATE POLICY "Audit Logs: Access" ON audit_logs FOR ALL TO authenticated USING (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id());
CREATE POLICY "Applications: Access" ON applications FOR ALL TO authenticated USING (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id());
CREATE POLICY "Activities: Access" ON activities FOR ALL TO authenticated USING (public.m_role() = 'Admin' OR woreda_id = public.m_woreda_id());
CREATE POLICY "Activities: View All" ON activities FOR SELECT TO authenticated USING (true);

-- WOREDAS
CREATE POLICY "Woredas: View All" ON woredas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Woredas: Admin Modify" ON woredas FOR ALL TO authenticated USING (public.m_role() = 'Admin');

-- ==========================================
-- 6. VIEWS & FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION insert_audit_log(p_user TEXT, p_role TEXT, p_action TEXT, p_details TEXT, p_ip_address TEXT, p_status TEXT) 
RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_logs (woreda_id, "user", role, action, details, ip_address, status)
    VALUES (public.m_woreda_id(), p_user, p_role, p_action, p_details, p_ip_address, p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE VIEW woreda_dashboard WITH (security_invoker = on) AS
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

CREATE OR REPLACE VIEW officer_vehicle_summary WITH (security_invoker = on) AS 
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

CREATE OR REPLACE VIEW debug_jwt_claims AS
SELECT 
    auth.uid() as user_id, 
    public.m_role() as current_role, 
    public.m_woreda_id() as current_woreda_id, 
    (auth.jwt())::text as full_jwt;

-- ==========================================
-- 7. SEED DATA, INDEXES & SYSTEM SYNC
-- ==========================================
INSERT INTO woredas (name, code) VALUES
('Woreda 1', 'DILLA-W01'), ('Woreda 2', 'DILLA-W02'), ('Woreda 3', 'DILLA-W03'),
('Woreda 4', 'DILLA-W04'), ('Woreda 5', 'DILLA-W05'), ('Woreda 6', 'DILLA-W06'),
('Woreda 7', 'DILLA-W07'), ('Woreda 8', 'DILLA-W08'), ('Woreda 9', 'DILLA-W09'),
('Woreda 10', 'DILLA-W10'), ('Woreda 11', 'DILLA-W11'), ('Woreda 12', 'DILLA-W12');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_violation_id ON payments(violation_id);
CREATE INDEX IF NOT EXISTS idx_violations_woreda ON violations(woreda_id);
CREATE INDEX IF NOT EXISTS idx_payments_woreda ON payments(woreda_id);
CREATE INDEX IF NOT EXISTS idx_users_woreda ON users(woreda_id);
CREATE INDEX IF NOT EXISTS idx_alerts_woreda ON alerts(woreda_id);
CREATE INDEX IF NOT EXISTS idx_applications_woreda ON applications(woreda_id);
CREATE INDEX IF NOT EXISTS idx_activities_woreda ON activities(woreda_id);
CREATE INDEX IF NOT EXISTS idx_violations_plate ON violations(plate_number);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
CREATE INDEX IF NOT EXISTS idx_payments_receipt ON payments(receipt_number);

-- Realtime Configuration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE activities;
ALTER PUBLICATION supabase_realtime ADD TABLE violations;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE woredas;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;

-- Critical Initial Sync for Existing Users (if any were created before this script)
UPDATE auth.users SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
        'role', (SELECT role FROM public.users WHERE id = auth.users.id), 
        'woreda_id', (SELECT woreda_id FROM public.users WHERE id = auth.users.id)
    ) 
WHERE id IN (SELECT id FROM public.users);

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