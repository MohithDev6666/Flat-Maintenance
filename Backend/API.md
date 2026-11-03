# Flat Maintenance API

Base URL for local development: `http://localhost:8080/api`

Unless marked **Public**, requests require:

```http
Authorization: Bearer <access-token>
```

## Authentication

| Method | URL | Access |
|---|---|---|
| POST | `http://localhost:8080/api/auth/register` | Public |
| POST | `http://localhost:8080/api/auth/login` | Public |
| POST | `http://localhost:8080/api/auth/refresh` | Public |
| GET | `http://localhost:8080/api/auth/me` | Authenticated |
| GET | `http://localhost:8080/api/auth/permissions` | Authenticated |
| POST | `http://localhost:8080/api/auth/logout` | Authenticated |
| PUT | `http://localhost:8080/api/auth/password` | Authenticated |

## RBAC management

These are the existing RBAC endpoints. Application routes do not replace or
modify their CRUD implementation.

| Method | URL | Required permission |
|---|---|---|
| GET | `http://localhost:8080/api/modules` | Authenticated |
| POST | `http://localhost:8080/api/modules` | `modules:create` |
| GET | `http://localhost:8080/api/modules/:id` | `modules:read` |
| PUT | `http://localhost:8080/api/modules/:id` | `modules:update` |
| DELETE | `http://localhost:8080/api/modules/:id` | `modules:delete` |
| GET | `http://localhost:8080/api/roles` | `roles:read` |
| POST | `http://localhost:8080/api/roles` | `roles:create` |
| GET | `http://localhost:8080/api/roles/:id` | `roles:read` |
| PUT | `http://localhost:8080/api/roles/:id` | `roles:update` |
| DELETE | `http://localhost:8080/api/roles/:id` | `roles:delete` |
| PUT | `http://localhost:8080/api/roles/:id/permissions` | `roles:update` |
| GET | `http://localhost:8080/api/users` | `users:read` |
| POST | `http://localhost:8080/api/users` | `users:create` |
| GET | `http://localhost:8080/api/users/:id` | `users:read` |
| PUT | `http://localhost:8080/api/users/:id` | `users:update` |
| DELETE | `http://localhost:8080/api/users/:id` | `users:delete` |
| PUT | `http://localhost:8080/api/users/:id/role` | `users:update` |

## Application modules

For collection resources, `GET` lists records, `GET /:id` gets one record,
`POST` creates, `PUT /:id` updates, and `DELETE /:id` deletes.

### Categories

| Method | URL | Required permission |
|---|---|---|
| GET | `http://localhost:8080/api/categories` | `categories:view` |
| GET | `http://localhost:8080/api/categories/:id` | `categories:view` |
| POST | `http://localhost:8080/api/categories` | `categories:add` |
| PUT | `http://localhost:8080/api/categories/:id` | `categories:edit` |
| DELETE | `http://localhost:8080/api/categories/:id` | `categories:delete` |

### Flats

| Method | URL | Required permission |
|---|---|---|
| GET | `http://localhost:8080/api/flats` | `flats:view` |
| GET | `http://localhost:8080/api/flats/:id` | `flats:view` |
| POST | `http://localhost:8080/api/flats` | `flats:add` |
| PUT | `http://localhost:8080/api/flats/:id` | `flats:edit` |
| DELETE | `http://localhost:8080/api/flats/:id` | `flats:delete` |

### Flat management

| Method | URL | Required permission |
|---|---|---|
| GET | `http://localhost:8080/api/flat-management` | `flatManagement:view` |
| GET | `http://localhost:8080/api/flat-management/:id` | `flatManagement:view` |
| POST | `http://localhost:8080/api/flat-management` | `flatManagement:add` |
| PUT | `http://localhost:8080/api/flat-management/:id` | `flatManagement:edit` |
| DELETE | `http://localhost:8080/api/flat-management/:id` | `flatManagement:delete` |

`http://localhost:8080/api/flats` and
`http://localhost:8080/api/flat-management` operate on the same flats
collection.

### Owners

| Method | URL | Required permission |
|---|---|---|
| GET | `http://localhost:8080/api/owners` | `owners:view` |
| GET | `http://localhost:8080/api/owners/:id` | `owners:view` |
| POST | `http://localhost:8080/api/owners` | `owners:add` |
| PUT | `http://localhost:8080/api/owners/:id` | `owners:edit` |
| DELETE | `http://localhost:8080/api/owners/:id` | `owners:delete` |

### Tenants

| Method | URL | Required permission |
|---|---|---|
| GET | `http://localhost:8080/api/tenants` | `tenants:view` |
| GET | `http://localhost:8080/api/tenants/:id` | `tenants:view` |
| POST | `http://localhost:8080/api/tenants` | `tenants:add` |
| PUT | `http://localhost:8080/api/tenants/:id` | `tenants:edit` |
| DELETE | `http://localhost:8080/api/tenants/:id` | `tenants:delete` |

### Expenses

| Method | URL | Required permission |
|---|---|---|
| GET | `http://localhost:8080/api/expenses` | `expenses:view` |
| GET | `http://localhost:8080/api/expenses/:id` | `expenses:view` |
| POST | `http://localhost:8080/api/expenses` | `expenses:add` |
| PUT | `http://localhost:8080/api/expenses/:id` | `expenses:edit` |
| DELETE | `http://localhost:8080/api/expenses/:id` | `expenses:delete` |

Residents can create expenses and edit their own expenses; only administrators
can delete expenses.

### Payments

| Method | URL | Required permission |
|---|---|---|
| GET | `http://localhost:8080/api/payments` | `payments:view` |
| GET | `http://localhost:8080/api/payments/:id` | `payments:view` |
| POST | `http://localhost:8080/api/payments` | `payments:add` |
| PUT | `http://localhost:8080/api/payments/:id` | `payments:edit` |
| DELETE | `http://localhost:8080/api/payments/:id` | `payments:delete` |
| POST | `http://localhost:8080/api/payments/:id/flag` | `payments:edit` |
| DELETE | `http://localhost:8080/api/payments/:id/flag` | `payments:edit` |

Resident payment reads and submissions are scoped to the logged-in owner or
tenant profile. Payment review and payment updates/deletes are administrator
operations.

### Building

| Method | URL | Required permission |
|---|---|---|
| GET | `http://localhost:8080/api/building` | `building:view` |
| PUT | `http://localhost:8080/api/building` | `building:edit` |

Building information is a single configuration record, so it has no
collection-create or delete endpoint.

### Month locks

| Method | URL | Required permission |
|---|---|---|
| GET | `http://localhost:8080/api/month-locks` | `lockMonth:view` |
| GET | `http://localhost:8080/api/month-locks/:month` | `lockMonth:view` |
| PUT | `http://localhost:8080/api/month-locks/:month` | `lockMonth:manage` |

Use the `YYYY-MM` format for `:month` and pass `{"locked":true}` or
`{"locked":false}` to lock or unlock a month. The endpoint preserves lock
history.

### Reports and audit

| Method | URL | Required permission |
|---|---|---|
| GET | `http://localhost:8080/api/dashboard` | `dashboard:view` |
| GET | `http://localhost:8080/api/summary` | `summary:view` |
| GET | `http://localhost:8080/api/contribution` | `contribution:view` |
| GET | `http://localhost:8080/api/audit` | `recentChanges:view` |
| GET | `http://localhost:8080/api/audit/:id` | `recentChanges:view` |

Reports are read-only aggregate responses. Audit records are read-only through
the API and are created by application mutations.

### User profile links

| Method | URL | Required access |
|---|---|---|
| GET | `http://localhost:8080/api/me/profile-link` | Authenticated; own link |
| GET | `http://localhost:8080/api/user-profile-links` | `users:view` and current RBAC administrator |
| PUT | `http://localhost:8080/api/users/:id/profile-link` | `users:edit` and current RBAC administrator |
| DELETE | `http://localhost:8080/api/users/:id/profile-link` | `users:edit` and current RBAC administrator |

## List query parameters

CRUD collection endpoints accept `limit` (default `100`, maximum `500`) and
`offset` (default `0`). Depending on the resource, list filters include
`month`, `flatId`, `needsCheck`, and `status`.

Examples:

```text
GET http://localhost:8080/api/expenses?month=2026-11&limit=100
GET http://localhost:8080/api/payments?flatId=flat-101&needsCheck=true
GET http://localhost:8080/api/owners?limit=50&offset=0
```

Replace `:id` with the resource ID. Deletes return `204 No Content` when
successful; other successful requests return JSON.
