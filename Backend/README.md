# Flat Maintenance REST API

The application backend lives under `internal/` and uses Gin, MongoDB, and the
existing RBAC package in `rbac/`. RBAC authentication, role, permission, and
repository code remain in that package. Application Mongo models are defined
in `internal/models/` (one file per collection); Mongo indexes are initialized
by `db.EnsureIndexes` in `internal/db/indexes.go`.

## Run locally

From `Backend`, copy `.env.example` to `.env`, set a private JWT secret and
your MongoDB connection details, then start the server:

```powershell
Copy-Item .env.example .env
go run ./cmd/server
```

## Run with Docker Compose

From the repository root, make sure `Backend/.env` contains your backend
configuration, then start the frontend and API:

```sh
docker compose up --build
```

Open <http://localhost:3000>. Compose loads backend settings from
`Backend/.env` and does not start MongoDB; configure `MONGODB_URI` there to
point to the MongoDB instance you already run, using an address reachable from
the backend container. Nginx forwards `/api` requests to the backend. Stop the
containers with `docker compose down`.

The server reads `.env` from the process working directory. Existing process
environment values take precedence. Required values are:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection URI |
| `MONGODB_DATABASE` | Database name used by RBAC and application modules |
| `JWT_SECRET` | Secret used to sign RBAC tokens |

Optional values are `HTTP_ADDRESS` (defaults to `:8080`), `JWT_ISSUER`
(defaults to `flat-maintenance`), `JWT_EXPIRATION` (defaults to `24h`, using
Go duration syntax), and `LOG_DIR` (defaults to `logs`).

## Routes

All routes are prefixed with `/api`. Except for registration, login, and token
refresh, requests require a valid RBAC bearer token and the route-specific RBAC
permission.

See [API.md](./API.md) for the complete endpoint and permission reference.

| Module | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, `GET /auth/permissions`, `POST /auth/logout`, `PUT /auth/password` |
| RBAC modules | `/modules`, `/roles`, and `/users` CRUD endpoints are registered by the existing RBAC router |
| Flats | `GET/POST /flats`, `GET/PUT/DELETE /flats/:id` |
| Flat management | `GET/POST /flat-management`, `GET/PUT/DELETE /flat-management/:id` |
| Building | `GET/PUT /building` |
| Owners | `GET/POST /owners`, `GET/PUT/DELETE /owners/:id` |
| Tenants | `GET/POST /tenants`, `GET/PUT/DELETE /tenants/:id` |
| Expense categories | `GET/POST /categories`, `GET/PUT/DELETE /categories/:id` |
| Expenses | `GET/POST /expenses`, `GET/PUT/DELETE /expenses/:id` |
| Payments | `GET/POST /payments`, `GET/PUT/DELETE /payments/:id`, `POST /payments/:id/flag`, `DELETE /payments/:id/flag` |
| Dashboard | `GET /dashboard` |
| Month summary | `GET /summary` |
| Contribution | `GET /contribution` |
| Recent changes | `GET /audit`, `GET /audit/:id` |
| Month locks | `GET /month-locks`, `GET /month-locks/:month`, `PUT /month-locks/:month` |
| User profile links | `GET /me/profile-link`, `GET /user-profile-links`, `PUT/DELETE /users/:id/profile-link` |

Stored business resources expose list, detail, create, update, and delete
operations. Flat management and resident flats operate on the same flats
collection; `flat-management` is the admin-facing CRUD route and `/flats`
provides the same operations with its own RBAC permissions. The building is a
single configuration record updated through `PUT /building`, rather than a
multi-record collection. Month locks use lock/unlock operations so their audit
history is preserved. Dashboard, summary, contribution, and audit endpoints
are read-only because they return derived data or append-only change history.

Collection endpoints support `limit` (default `100`, maximum `500`) and
`offset`; resource lists also support the filters implemented by their handler.
Responses use the frontend's camelCase JSON fields. Deletes return `204 No
Content`; validation and business-rule errors return JSON with an `error`
field.

## Resident profile links and data access

RBAC owns user accounts and role assignments. The application stores the
owner/tenant-to-RBAC-user relationship in MongoDB's `user-profile-links`
collection. An RBAC administrator with the `users:edit` permission can link an
account:

```http
PUT /api/users/{rbacUserId}/profile-link
Content-Type: application/json

{"kind":"owner","ownerId":"owner-101"}
```

Use `{"kind":"tenant","tenantId":"tenant-101"}` for a tenant or
`{"kind":"admin"}` for an RBAC administrator. Each owner and tenant can have
one linked login. Role changes, inactive RBAC users/roles, or stale profile
links are checked against the current MongoDB RBAC records.

Payment submissions from residents have `userId`, payer, flat, resident, and
role fields set from the authenticated account's profile link; client-supplied
values for those fields are ignored. Owners see owner payments for their
current flat; tenants see payments for their linked tenant record. Only
administrators can edit/delete or flag payments.

Residents can see building expenses, but expense creation and edits attribute
the payer to the authenticated linked resident. Residents can edit only their
own expenses and cannot delete expenses; administrators can manage all expense
records. The API expects attachment URLs to be durable; browser-local `blob:`
URLs are not available after the originating browser session.

## Module organization

```
cmd/server/main.go        entrypoint: config, logs, Mongo, RBAC, routes, graceful shutdown
internal/config           .env / environment configuration
internal/db               Mongo connection and index setup
internal/logs             Info/Warning/Error loggers (console + daily files in LOG_DIR)
internal/models           typed Mongo models, one file per collection
internal/routes           router.go (entrypoint), rbac.go (RBAC routes), api.go (module wiring)
internal/utils            shared HTTP error, request and helper functions
internal/modules/<name>/
  handler/<name>_handler.go       handler interface
  handler/<name>_handler_impl.go  Gin handlers
  repo/<name>_repo.go             repository interface
  repo/<name>_repo_impl.go        Mongo repository
  service/<name>_service.go       service interface
  service/<name>_service_impl.go  business rules
  routes/<name>_route.go          route + RBAC permission registration
```

Repositories are constructed once in `internal/routes/api.go` and injected
into the services that need them; handlers depend only on service interfaces.
`flatmanagement` reuses the flats service behind its own permissions, and
`reports` serves `/dashboard`, `/summary`, and `/contribution`.

The application layer also enforces month locks, validates linked records,
prevents overlapping tenancies, synchronizes flat occupancy when tenant
records change, releases the previous owner's flat during ownership transfer,
propagates category renames to expenses, and records application mutations in
the `audit` collection.
