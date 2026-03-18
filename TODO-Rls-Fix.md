# WoredaAdmin RLS Fix - TODO

## Breakdown of Approved Edit Plan

### 1. [✅ DONE] Create TODO.md with progress tracking
   - File created/updated with step list

### 2. [✅ DONE] Update jwt.sql with real-time m_role()/m_woreda_id()
   - Functions now query public.users WHERE id = auth.uid() (real-time)
   - Added bulk sync + full verification queries
   - Ready for Supabase SQL Editor

### 3. [ ] User runs updated jwt.sql in Supabase SQL Editor
   - Manual: Copy-paste → Execute

### 4. [ ] Test verification queries (as WoredaAdmin)
   - `SELECT public.m_role(), public.m_woreda_id();` → Expect correct values
   - Update user role/woreda → Check auth.users metadata sync
   - `SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'users';` → Expect 't'
   - Re-login → UserManagementScreen shows only own woreda users

### 5. [ ] [OPTIONAL] Client-side list filter in UserManagementScreen.tsx
   - Filter users before display if WoredaAdmin

### 6. [ ] Final test: `npm run dev` → Full E2E (login → manage users)

**Next Action**: Update jwt.sql → Run in Supabase → Test.

**Status**: Step 1 ✅ | Awaiting jwt.sql update
