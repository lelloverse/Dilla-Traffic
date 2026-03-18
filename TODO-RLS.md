# RLS Token/DB Sync Fix - TODO

## Updated Plan for WoredaAdmin Visibility Issue

**Current Behavior (Expected/OK):**
- WoredaAdmin calls getUsers() → sees ALL users (no app-level filtering)
- UI conditionally hides Edit/Deactivate buttons for other WoredaAdmins/Admins (good)
- RLS policies handle DB-level protection

**Information Gathered:**
- UserManagementScreen.tsx: `getUsers()` (all users), UI filters actions via `currentUser.role === UserRole.WoredaAdmin && user.role in ('Officer', 'Clerk')`
- jwt.sql: RLS uses m_role()/m_woreda_id() from static JWT claims
- database.ts: getUsers() no filters

**Plan:**
1. **jwt.sql** [PENDING]: Update m_woreda_id/m_role to query public.users for real-time sync
2. **UserManagementScreen.tsx** [OPTIONAL]: Client-side filter users list for WoredaAdmin (only own woreda + self)
3. Test: WoredaAdmin sees only district staff; actions protected

**Next:** Update jwt.sql → Paste in Supabase SQL Editor → Re-login → Test dashboard access.

**Status:** Visibility OK per UI logic; RLS sync pending for post-update access."

