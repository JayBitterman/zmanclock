Prepare a clean git commit:

1. Run `git status` and `git diff` to review all changes
2. Group related changes logically — if there are unrelated changes, suggest separate commits
3. Write a commit message following conventional commits format:
   - `feat: add user authentication endpoint`
   - `fix: resolve race condition in websocket handler`
   - `refactor: extract validation logic into middleware`
   - `docs: update API documentation for /users`
   - `test: add integration tests for payment flow`
4. Stage the relevant files with `git add`
5. Show me the commit message and staged files before committing
6. Only commit after I confirm
