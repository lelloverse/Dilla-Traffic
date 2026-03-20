# 🚀 Login Debug Guide - UPDATED ✅ (Step 4 Complete)

## Test the Fix (TODO-Login-Fix.md Step 5)

**Status**: Code ✅ | Ready for test → Supabase diagnostics

### 1. Run & Test
```
cd "c:/Users/hp/Downloads/Licensing System"
npm install
npm run dev
```

### 2. DevTools Setup
```
F12 → Console tab (watch logs)
F12 → Network tab → Filter: XHR/Fetch
Clear both (trash icon)
```

### 3. **Test Login** (`maltt` + password):
**NEW Expected Console Logs**:
```
🪨 Supabase client initialized: {...}
🔐 Login attempt: {username: 'maltt'}
🔍 [LOGIN] Single query for username/email: maltt  
✅ [LOGIN] Profile query OK (XXms): {found: true/false, username: '...', status: '...'}
🔑 Attempting Supabase auth for: user@example.com
⏹️ Login process ended
```

### 4. **Diagnosis Table**
| Symptom | Check | Fix |
|---|---|---|
| **Stops at `🔍 Single query`** | Network: `rest/v1/users?select=*...or=username.eq.maltt,email.eq.maltt` | **🚨 RLS Issue** → Supabase SQL Editor: `SELECT * FROM users WHERE username='maltt';` |
| **`Profile query OK (8000ms+)`** | Slow but works | Add index: `CREATE INDEX ON users(username);` |
| **`❌ Profile query FAILED`** | Network error code | Copy error → paste here |
| **`✅ found: false`** | No user | Create test user OR check status='Active' |
| **Works! → Auth fails** | `/auth/v1/token?` 401 | Wrong password in auth.users |

### 5. **Supabase SQL Editor** (Critical):
```
-- 1. Does user exist?
SELECT id, username, email, status, can_access_web FROM users WHERE username = 'maltt';

-- 2. RLS test (anon access)
SET ROLE anon;
SELECT * FROM users WHERE username = 'maltt' LIMIT 1;

-- 3. Index check
SELECT schemaname, tablename, indexname FROM pg_indexes WHERE tablename = 'users';
```

### 6. **NEXT**: Reply with:
```
1. Screenshot Network tab → supabase.co query (status/time)
2. Console logs (full sequence)
3. SQL results (user exists? status?)
```

**Run test → Share results → Final fix!**

