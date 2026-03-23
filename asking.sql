-- ==========================================
-- FIX 1: Update handle_new_user to include all fields
-- ==========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

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
    COALESCE(NEW.raw_app_meta_data->>'role', 'Clerk'),
    'Active',
    (NEW.raw_app_meta_data->>'woreda_id')::UUID,
    COALESCE((NEW.raw_app_meta_data->>'can_access_web')::boolean, true),
    COALESCE((NEW.raw_app_meta_data->>'can_access_mobile')::boolean, false),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- FIX 2: Update audit log function to match frontend
-- ==========================================
DROP FUNCTION IF EXISTS insert_audit_log(text, text, text, text, uuid);

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

-- ==========================================
-- FIX 3: Add missing indexes for login performance
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_users_username_lookup ON users(username) WHERE status = 'Active';
CREATE INDEX IF NOT EXISTS idx_users_email_lookup ON users(email) WHERE status = 'Active';
CREATE INDEX IF NOT EXISTS idx_users_login_composite ON users(username, email, status);

-- ==========================================
-- FIX 4: Create a test admin user (if needed)
-- ==========================================
-- First, check if your admin exists in auth.users
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
            recovery_token
        ) VALUES (
            admin_id,
            '00000000-0000-0000-0000-000000000000',
            admin_email,
            crypt('Admin123!', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"],"role":"Admin"}',
            jsonb_build_object('username', 'admin', 'full_name', 'System Administrator'),
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        ) ON CONFLICT (id) DO NOTHING;
    END IF;
    
    -- Ensure public.users exists
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
-- FIX 5: Verify everything is working
-- ==========================================
-- Check users table
SELECT id, username, email, role, status FROM users;

-- Check auth metadata sync
SELECT id, email, raw_app_meta_data->>'role' as role 
FROM auth.users 
WHERE email = 'antoniosawyne@gmail.com';

-- Create debug view
CREATE OR REPLACE VIEW debug_jwt_claims AS
SELECT 
    auth.uid() as user_id,
    public.m_role() as current_role,
    public.m_woreda_id() as current_woreda_id,
    (auth.jwt())::jsonb as full_jwt;