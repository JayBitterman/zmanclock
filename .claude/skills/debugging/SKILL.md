---
name: debugging
description: Use when diagnosing bugs, fixing errors, or troubleshooting unexpected behavior. Covers systematic debugging approach for frontend and backend code.
---

# Debugging Skill

## Step 1: Reproduce
- Get the exact steps to trigger the bug
- Check: does it happen every time or intermittently?
- Check: does it happen in all environments (dev, prod, specific browsers)?
- Read the actual error message carefully — the answer is often right there

## Step 2: Isolate
- What changed recently? Check `git log --oneline -20` and `git diff`
- Narrow the scope: frontend or backend? Which file, which function?
- Add targeted logging at key points (inputs, outputs, branch decisions)
- For React: check the component tree — is the bug in this component or a parent/child?
- For API issues: test the endpoint directly with curl/Postman — is it frontend or backend?

## Step 3: Understand
- Read the code path slowly, line by line. Don't assume.
- Check types at runtime — `typeof`, `console.log(JSON.stringify(x, null, 2))`
- Common culprits:
  - **Stale state/closure**: React hooks capturing old values
  - **Race conditions**: async operations completing in unexpected order
  - **Null/undefined**: missing null checks, optional chaining needed
  - **Type coercion**: `==` vs `===`, string vs number comparisons
  - **Off-by-one**: array indexing, pagination, boundary conditions
  - **Environment differences**: missing env vars, different Node versions, OS path separators

## Step 4: Fix
- Fix the root cause, not the symptom
- If you're adding a special case or workaround, document why
- Add a test that would have caught this bug
- Check for the same pattern elsewhere in the codebase (`grep -r "similar_pattern"`)

## Step 5: Verify
- Confirm the fix resolves the original reproduction steps
- Run the existing test suite — make sure nothing else broke
- Check edge cases around the fix

## Quick Diagnostic Commands
```bash
# Recent changes
git log --oneline -10
git diff HEAD~1

# Find usages of a function/variable
grep -rn "functionName" --include="*.ts" --include="*.tsx"

# Check what's running on a port
netstat -ano | findstr :3000    # Windows
lsof -i :3000                  # Mac/Linux

# Node.js memory/process issues
node --max-old-space-size=4096  # Increase memory limit

# Check environment
node -e "console.log(process.env.MY_VAR)"
```

## React-Specific Debugging
- React DevTools > Components tab: inspect props, state, hooks
- React DevTools > Profiler: identify unnecessary re-renders
- `useEffect` running twice in dev? That's React Strict Mode, not a bug
- State not updating? `setState` is async — don't read it immediately after setting

## Database Debugging
- Log the actual SQL query being generated (not the ORM call)
- Check for missing indexes on filtered/joined columns
- Verify connection pool isn't exhausted
- Check for uncommitted transactions holding locks
