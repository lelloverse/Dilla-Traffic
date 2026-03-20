# Login Timeout Fix - Progress Tracker

**Status**: ✅ Plan Approved | 🔄 Code Updates In Progress

## Steps:

### 1. [✅] Create TODO.md with detailed steps (this file)
### 2. [✅] Update `database.ts`: Use existing `getUserProfile()` ✅
   - Uses `.or()` for username|email lookup
   - Adds timeout/retry logic
   - Returns `null` on 404/empty

### 3. [✅] Refactor `App.tsx` handleLogin(): Single getUserProfile() + timing ✅
   - Replace direct Supabase queries → `database.getUserByUsernameOrEmail(username)`
   - Add detailed console logging + Network tab instructions
   - Improve error messages

### 4. [✅] Update `DEBUG.md`: Enhanced test guide + SQL queries ✅

### 5. [✅] **USER TEST** Complete:
   - ✅ Index exists: `users_username_key`
   - ❌ Timeout on `getUserProfile('maltt')` → RLS blocking anon query
   - 🔍 Next: Fix RLS policy for public login lookup

### 6. [🔄] **SUPABASE RLS FIX** (Execute now):
   ```
   1. Supabase Dashboard → SQL Editor
   2. Copy RLS-Login-Fix.sql → Execute
   3. Test: npm run dev → Login 'maltt'
   
   Expected: ✅ Profile query OK (<500ms) → Full login success
   ```

### 7. [ ] [✅ COMPLETE] Login works → Full E2E test

**Next**: database.ts → App.tsx → Test

**Instructions**:
- Each step completes → I'll check off + move to next
- After Step 4 → User tests login + reports Network/SQL results

