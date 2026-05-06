---
name: api-design
description: Use when building REST APIs, designing endpoints, handling authentication, or structuring backend routes. Covers Node.js/Express patterns and database integration.
---

# API Design Skill

## Route Structure
- RESTful conventions: `GET /users`, `POST /users`, `GET /users/:id`, `PUT /users/:id`, `DELETE /users/:id`
- Use plural nouns for resources (`/users` not `/user`)
- Nest related resources: `GET /users/:id/orders`
- Keep URLs lowercase with hyphens: `/api/user-profiles` not `/api/userProfiles`
- Version your API if it's public: `/api/v1/users`

## Request Handling
- Validate ALL input at the boundary (use Zod, Joi, or similar)
- Parse and validate: path params, query params, request body, headers
- Return early on validation failure with 400 and specific error messages
- Sanitize user input before database operations

## Response Patterns
```
Success:     { data: { ... } }
List:        { data: [...], pagination: { page, limit, total } }
Error:       { error: { code: "NOT_FOUND", message: "User not found" } }
```
- Use proper HTTP status codes:
  - 200 OK, 201 Created, 204 No Content
  - 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict
  - 500 Internal Server Error
- Never leak stack traces or internal details in production error responses

## Authentication & Authorization
- Use JWT or session-based auth (be consistent within the project)
- Auth middleware runs before route handlers
- Separate authentication (who are you?) from authorization (can you do this?)
- Store secrets in environment variables, never in code
- Hash passwords with bcrypt (cost factor 10-12)

## Database Integration
- Use parameterized queries — NEVER string-concatenate SQL
- Wrap multi-step operations in transactions
- Add indexes for columns used in WHERE, JOIN, ORDER BY
- Paginate list endpoints (don't return unbounded results)
- Use connection pooling

## Error Handling Middleware
- Centralized error handler as the last middleware
- Catch async errors (use express-async-errors or wrap handlers)
- Log errors with request context (method, URL, user ID, timestamp)
- Different error detail levels for dev vs prod

## Common Gotchas
- Forgetting to `await` async operations (returns Promise instead of value)
- Not handling duplicate key / unique constraint violations (return 409, not 500)
- Missing CORS configuration for frontend-backend communication
- Forgetting to set `Content-Type` headers
- Not rate-limiting public endpoints
- Returning the password hash in user objects (exclude sensitive fields)
