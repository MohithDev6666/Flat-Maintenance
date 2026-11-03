# Tride RBAC — API Documentation

Complete reference for all HTTP endpoints exposed by the RBAC package. All routes are mounted under your chosen prefix (e.g. `/api/v1`) and return a unified JSON envelope.

---

## Response Envelope

Every response uses `models.JSONResponse`:

```json
// Success
{ "status": "OK", "code": 200, "data": { ... } }

// Created
{ "status": "Created", "code": 201, "data": { ... } }

// Error
{ "status": "Conflict", "code": 409, "error": "role already exists" }
```

**Status codes used:**

| Code | Meaning |
|------|---------|
| `200` | OK |
| `201` | Created |
| `400` | Bad Request (invalid body / validation failure) |
| `401` | Unauthorized (missing or invalid token) |
| `403` | Forbidden (token valid, permission denied) |
| `404` | Not Found |
| `409` | Conflict (duplicate) |
| `500` | Internal Server Error |

---

## Data Models

### User
```json
{
  "id": "60c72b2f9b1d8b2d88f6b12a",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "role_id": "60c72b2f9b1d8b2d88f6b12b",
  "active": 1,
  "created_at": "2026-08-17T10:00:00Z",
  "updated_at": "2026-08-17T10:00:00Z",
  "role_level": 1,
  "is_admin": true
}
```
> `password` is never returned. `role_level` and `is_admin` are computed from the role at query time and never persisted on the user document. `id` is a generic string (UUID for PostgreSQL, ObjectID hex or string for MongoDB).

### Role
```json
{
  "id": "60c72b2f9b1d8b2d88f6b12b",
  "name": "Super Admin",
  "description": "Full system access.",
  "level": 1,
  "is_admin": true,
  "active": 1,
  "permissions": [
    {
      "module_key": "invoices",
      "view": true,
      "add": true,
      "edit": true,
      "delete": true
    }
  ],
  "created_at": "2026-08-17T10:00:00Z",
  "updated_at": "2026-08-17T10:00:00Z"
}
```
> `level` is automatically assigned as `maxLevel + 1` on creation and is **immutable** thereafter.  
> `permissions[].module_key` can store either the module ID (UUID or ObjectID) or the canonical string key (e.g. `"users"`, `"invoices"`). Both are resolved dynamically and transparently by the enforcer.

### Module
```json
{
  "id": "60c72b2f9b1d8b2d88f6b12c",
  "key": "invoices",
  "name": "Invoices Module",
  "description": "Manage customer billing.",
  "is_master": false,
  "permissions": ["read", "create", "update", "delete"],
  "created_at": "2026-08-17T10:00:00Z",
  "updated_at": "2026-08-17T10:00:00Z"
}
```
> `key` is normalized to lowercase on creation and is unique. It is the string used in permission checks (`invoices:read`).  
> `is_master: true` modules (users, roles, modules) are **only visible to admin roles**.

---

## 1. Authentication Endpoints

### `POST /auth/register`

**Access:** Public

Creates a new user account. All fields are validated and trimmed server-side; `email` is lowercased.

> **Note:** Unlike earlier versions, the first registered user is **not** automatically assigned the Super Admin role. The Super Admin role is seeded at startup — an admin must assign it via `PUT /users/:id/role`.

**Request:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword123",
  "phone": "+1234567890"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | ✅ | Trimmed |
| `email` | string | ✅ | Trimmed, lowercased, unique |
| `password` | string | ✅ | Min 4 chars, bcrypt-hashed |
| `phone` | string | ❌ | |

**Response `201`:**
```json
{
  "status": "Created",
  "code": 201,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { /* User object */ }
  }
}
```

**Errors:** `400` validation failure · `409` email already registered

---

### `POST /auth/login`

**Access:** Public

**Request:**
```json
{
  "email": "jane@example.com",
  "password": "securepassword123"
}
```

**Response `200`:** Same `{ token, user }` shape as Register.

**Errors:** `401` invalid credentials · `403` account suspended

---

### `POST /auth/logout`

**Access:** Authenticated (Bearer token)

Invalidates the current token by adding it to the blocklist cache for the remainder of its TTL. If no cache backend is configured, logout is a no-op (token remains technically valid until expiry).

**Response `200`:** `"logged out successfully"`

---

### `POST /auth/refresh`

**Access:** Public (valid, non-expired Bearer token)

Issues a new token with a fresh expiry. The old token remains valid until it naturally expires (or until logout is called).

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**
```json
{ "status": "OK", "code": 200, "data": { "token": "eyJ..." } }
```

**Errors:** `401` invalid or expired token

---

### `GET /auth/me`

**Access:** Authenticated

Returns the full profile of the currently authenticated user, including computed `role_level` and `is_admin`.

**Response `200`:** `User` object.

---

### `GET /auth/permissions`

**Access:** Authenticated

Returns a flat array of `moduleKey:action` strings representing every permission the caller's role grants.

Admin roles return permissions for **all registered modules**. Non-admin roles return only their assigned permissions.

**Response `200`:**
```json
{
  "status": "OK",
  "code": 200,
  "data": [
    "users:read", "users:create", "users:update", "users:delete",
    "roles:read", "roles:create", "roles:update", "roles:delete",
    "modules:read", "modules:create", "modules:update", "modules:delete"
  ]
}
```

---

### `PUT /auth/password`

**Access:** Authenticated

Changes the current user's password. Verifies the old password before updating.

**Request:**
```json
{
  "old_password": "securepassword123",
  "new_password": "brandnewpassword999"
}
```

**Response `200`:** `"password updated successfully"`

**Errors:** `400` incorrect current password · `500` update failed

---

## 2. Module Registry Endpoints

### `GET /modules`

**Access:** Authenticated — **filtered by role**

This is the discovery endpoint for the frontend. The response set depends on the caller's role:

| Caller | Sees |
|--------|------|
| Admin (`is_admin: true` or `level: 1`) | All modules (master + standard) |
| Non-admin | Only non-master modules the role has `view`/`read` access to |
| No role assigned | Empty list `[]` |

Admin status is determined by loading the role directly from the database (not from the permission list), so it works correctly even before any modules are assigned to the role.

**Response `200`:** Array of `Module` objects.

---

### `POST /modules`

**Access:** `modules:create`

Registers a new module. `key` is normalized to lowercase and must be unique.

**Request:**
```json
{
  "key": "invoices",
  "name": "Invoices Module",
  "description": "Manage customer billing details.",
  "is_master": false,
  "permissions": ["read", "create", "update", "delete"]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `key` | string | ✅ | Lowercased, unique, immutable after creation |
| `name` | string | ✅ | |
| `description` | string | ❌ | |
| `is_master` | bool | ❌ | Master modules are admin-only. Default `false` |
| `permissions` | string[] | ❌ | Declare available action labels for this module |

**Response `201`:** Created `Module` object.

**Errors:** `400` missing key or name · `409` key already taken

---

### `GET /modules/:id`

**Access:** `modules:read`

**Response `200`:** Single `Module` object.

**Errors:** `404` module not found

---

### `PUT /modules/:id`

**Access:** `modules:update`

Updates module metadata. `key` is immutable and cannot be changed after creation.

**Request:**
```json
{
  "name": "Customer Billing Invoices",
  "description": "Updated description.",
  "is_master": false,
  "permissions": ["read", "create", "update"]
}
```

**Response `200`:** Updated `Module` object.

**Errors:** `404` module not found

---

### `DELETE /modules/:id`

**Access:** `modules:delete`

Permanently removes the module record.

> ⚠️ Deleting a module while roles still reference its ID will leave orphaned permission objects. Clean up role permissions before deleting modules.

**Response `200`:** `"module deleted"`

**Errors:** `404` module not found

---

## 3. Role Management Endpoints

### `GET /roles`

**Access:** `roles:read`

Returns all roles sorted by `level` ascending (Level 1 = Super Admin at top).

**Response `200`:** Array of `Role` objects.

---

### `POST /roles`

**Access:** `roles:create`

Creates a new role. `level` is **automatically assigned** as `maxLevel + 1` using a database aggregation — do not send it in the request body (it is ignored).

**Request:**
```json
{
  "name": "Project Manager",
  "description": "Standard read/write access for project modules.",
  "is_admin": false,
  "active": 1,
  "permissions": []
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | ✅ | Unique |
| `description` | string | ❌ | |
| `is_admin` | bool | ❌ | Grants full access bypass. Use sparingly |
| `active` | int | ❌ | `1` = active (default), `0` = inactive |
| `permissions` | PermissionObject[] | ❌ | Can be set on creation or updated later |

**Response `201`:** Created `Role` object with assigned `level`.

**Errors:** `400` missing name · `409` name already taken

---

### `GET /roles/:id`

**Access:** `roles:read`

**Response `200`:** Single `Role` object.

**Errors:** `404` role not found

---

### `PUT /roles/:id`

**Access:** `roles:update`

Updates role metadata. `level` is immutable and is silently ignored if sent.

**Request:**
```json
{
  "name": "Lead Project Manager",
  "description": "Elevated project oversight.",
  "is_admin": false,
  "active": 1
}
```

**Response `200`:** Updated `Role` object.

**Errors:** `404` role not found · `409` name conflict

---

### `DELETE /roles/:id`

**Access:** `roles:delete`

Permanently removes the role.

> ⚠️ Users whose `role_id` points to a deleted role will have a stale reference. Reassign or delete affected users first.

**Response `200`:** `"role deleted"`

**Errors:** `404` role not found

---

### `PUT /roles/:id/permissions`

**Access:** `roles:update`

Replaces the role's full permission matrix. This is a **full replace**, not a patch — send the complete desired set.

`module_key` must be the **MongoDB ObjectID** (hex string) of the module, not its string key.

**Request:**
```json
{
  "permissions": [
    {
      "module_key": "60c72b2f9b1d8b2d88f6b12c",
      "view": true,
      "add": true,
      "edit": false,
      "delete": false
    },
    {
      "module_key": "60c72b2f9b1d8b2d88f6b12d",
      "view": true,
      "add": false,
      "edit": false,
      "delete": false
    }
  ]
}
```

**Response `200`:** `"permissions updated"`

**Errors:** `404` role not found

> **Cache:** The role cache entry is invalidated immediately after this call. The next permission check will fetch fresh data from MongoDB.

---

## 4. User Management Endpoints

### `GET /users`

**Access:** `users:read`

Returns all users sorted by creation date descending, with `role_level` and `is_admin` populated from a single batch role fetch.

**Response `200`:** Array of `User` objects.

---

### `POST /users`

**Access:** `users:create`

Creates a user directly (admin path, bypasses auth flow). The password is bcrypt-hashed in the service layer.

**Request:**
```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "password": "initialpassword",
  "phone": "+9876543210"
}
```

**Response `201`:** Created `User` object.

**Errors:** `400` validation failure · `409` email already taken

---

### `GET /users/:id`

**Access:** `users:read`

**Response `200`:** Single `User` object with role enrichment.

**Errors:** `404` user not found

---

### `PUT /users/:id`

**Access:** `users:update`

Partial update — only provided fields are changed. Email uniqueness is validated before update. Password is hashed if provided.

**Request:**
```json
{
  "name": "John A. Smith",
  "phone": "+9876543210",
  "active": 0
}
```

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Optional |
| `email` | string | Optional, unique |
| `password` | string | Optional, will be bcrypt-hashed |
| `phone` | string | Optional |
| `active` | *int | `0` = suspend, `1` = activate |

**Response `200`:** Updated `User` object.

**Errors:** `404` user not found · `409` email already taken

---

### `DELETE /users/:id`

**Access:** `users:delete`

Permanently removes the user record.

**Response `200`:** `"user deleted"`

**Errors:** `404` user not found

---

### `PUT /users/:id/role`

**Access:** `users:update`

Assigns a role to a user. Stamps `updated_at` on the user record.

**Request:**
```json
{
  "role_id": "60c72b2f9b1d8b2d88f6b12b"
}
```

**Response `200`:** `"role updated"`

**Errors:** `404` user not found
