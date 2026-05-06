Review the recent changes in this project as a senior developer would:

1. Run `git diff` to see all uncommitted changes
2. For each changed file, check:
   - Does it follow the project's existing patterns?
   - Are there any bugs, edge cases, or missing error handling?
   - Is anything hardcoded that should be configurable?
   - Are there security concerns (exposed secrets, unsanitized input, SQL injection)?
   - Is the code readable and well-named?
3. Run the test suite if one exists (check CLAUDE.md for the test command)
4. Run the linter if configured

Provide a concise summary:
- ✅ What looks good
- ⚠️ Issues to address (with specific file and line)
- 💡 Suggestions for improvement (optional, non-blocking)
