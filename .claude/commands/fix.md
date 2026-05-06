Fix the bug described above. Follow this approach:

1. Reproduce: understand what's broken and what the expected behavior is
2. Find the root cause — read the relevant code, don't guess
3. Check for the same bug pattern elsewhere with grep
4. Implement the minimal fix (don't refactor unrelated code)
5. Verify the fix works
6. Run tests if they exist (check CLAUDE.md for the test command)

If you can't reproduce or find the cause, say so and suggest diagnostic steps rather than guessing.
