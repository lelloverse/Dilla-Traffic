# Fix Deno TypeScript Errors in Supabase Edge Function

## Steps
- [x] 1. Delete supabase/functions/reset-password/index.deno.ts
- [x] 2. Update .vscode/settings.json with deno.enablePaths
- [x] 3. Reload VSCode window
- [ ] 4. Fix supabase/config.toml + Test: supabase functions serve reset-password (no TS errors)
- [ ] 5. Deploy: supabase functions deploy reset-password

**Verification:**
```
# Step 4 test command (in project root)
npx supabase functions serve reset-password --env-file .env
```

