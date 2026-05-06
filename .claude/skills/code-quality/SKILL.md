---
name: code-quality
description: Use when writing, reviewing, or refactoring code. Covers clean code patterns, error handling, naming, and structure for TypeScript, Python, and Node.js projects.
---

# Code Quality Skill

## Before Writing Code
1. Read the relevant existing code first — match the project's patterns, don't introduce new ones
2. Check CLAUDE.md for project conventions (naming, file structure, import style)
3. Understand the data flow: where does input come from, where does output go?

## Naming
- Functions: verb + noun (`getUserById`, `calculateTotal`, `parseConfig`)
- Booleans: `is`/`has`/`should` prefix (`isLoading`, `hasPermission`)
- Constants: UPPER_SNAKE for true constants, camelCase for config objects
- Files: match the project convention (check existing files, don't guess)
- Be specific: `data`, `info`, `item`, `result` are almost never good names

## Functions
- Do one thing. If you need "and" to describe it, split it.
- Max ~30 lines is a good guideline (not a hard rule)
- Early returns over deep nesting
- Pure functions when possible — same input, same output, no side effects

## Error Handling
- Handle errors at the appropriate level (not everywhere)
- Use typed errors / custom error classes for different failure modes
- Never swallow errors silently (`catch(e) {}` is almost always wrong)
- Log with context: what operation failed, what input caused it
- For user-facing errors: friendly message. For dev errors: full stack trace.

## TypeScript-Specific
- Prefer `interface` for object shapes, `type` for unions/intersections
- Avoid `any` — use `unknown` and narrow with type guards
- Use discriminated unions for state machines and variant types
- `as` casts are a code smell — prefer type narrowing
- Enable `strict: true` in tsconfig

## Python-Specific
- Type hints on function signatures
- Use dataclasses or Pydantic for structured data, not raw dicts
- `pathlib.Path` over `os.path` for file operations
- f-strings for formatting (not `.format()` or `%`)
- Context managers (`with`) for resources

## Node.js / Backend
- Validate all external input at the boundary (API params, env vars, file contents)
- Use environment variables for config, never hardcode secrets
- Prefer async/await over callbacks or raw promises
- Connection pooling for databases
- Graceful shutdown handling

## Testing
- Test behavior, not implementation
- One assertion per test concept (multiple `expect` calls are fine if testing one behavior)
- Name tests: `should [expected behavior] when [condition]`
- Don't mock what you don't own — wrap external dependencies in your own interface

## Code Review Checklist
- Does it handle the unhappy path?
- Are there any hardcoded values that should be configurable?
- Could a new developer understand this without extra context?
- Are there any N+1 queries or unbounded loops?
- Is there appropriate logging for debugging production issues?
