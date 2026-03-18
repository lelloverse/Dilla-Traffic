# Licensing System

## Setup Instructions

1. **Supabase Configuration**
   - Create Supabase project
   - Run `jwt.sql` and `query.sql` in SQL Editor
   - Copy keys to `.env`:

```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

2. **Install Dependencies**
   ```
   npm install
   ```

3. **Development**
   ```
   npm run dev
   ```

## Features
- User Management (Admin password reset)
- Vehicle/Driver Registry
- Violations & Payments
- Woreda-based RLS

## Password Reset (Admin)
- Go to User Management
- Edit user → Reset Password field
- Uses service role to update Supabase Auth + custom table
