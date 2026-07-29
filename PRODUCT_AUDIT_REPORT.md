# Pandas Kitchen — Product Audit Report
**Date:** 2026-07-29
**Auditor:** Automated code review (Claude)
**Codebase:** `/home/logesh/Coding/Projects/pandas-kitchen`

---

## 1. Product Completion Report

### Auth Module — `apps/api/src/auth/`
| Feature | Status | Notes |
|---|---|---|
| Staff login (email + password) | Working | `auth.service.ts` — bcrypt compare, JWT issued |
| Refresh token | Working | Session DB lookup, new access token returned |
| Logout (token invalidation) | Working | Session deleted from DB |
| Current user (`/me`) | Working | Returns user profile |
| Change password | Working | Bcrypt re-hash, 8-char minimum enforced |
| Customer login (phone-based) | Working | Auto-creates customer if not found, FK guard on restaurant |
| Role-based guards | Working | `JwtAuthGuard` + `RolesGuard` wired globally via `APP_GUARD` |
| Public route decorator | Working | `@Public()` skips auth correctly |

### Menu Module — `apps/api/src/menu/`
| Feature | Status | Notes |
|---|---|---|
| Category CRUD | Working | Includes item-count, ownership guard |
| Delete category (with items) | Working | Blocked with `BadRequestException` if items exist |
| Menu item CRUD | Working | Includes allergens, isVeg, preparationTime, departmentId |
| Toggle item availability | Working | Atomic update |
| Variants CRUD | Working | Ownership verified via parent item |
| Addon Groups CRUD | Working | Full create/update/delete |
| Addons CRUD | Working | Linked to addon groups |
| Item ↔ AddonGroup linking | Working | Upsert + delete |
| Public menu (unauthenticated) | Working | Full category+item+variant+addon tree |
| Sort order | Working | All lists respect sortOrder + createdAt |

### Orders Module — `apps/api/src/orders/`
| Feature | Status | Notes |
|---|---|---|
| Create order (staff POS) | Working | Full pricing: subtotal, discount (flat/%), service charge, GST |
| Create public order (QR table) | Working | Auth-free, resolves restaurantId from branchId |
| Order number collision retry | Working | P2002 caught, retried once with new number |
| Customer stats update on order | Working | totalOrders + totalSpent incremented in transaction |
| List orders with pagination | Working | page/limit/status/date/branchId filters |
| Get single order | Working | Includes items, payments, table, customer |
| Update order status | Working | Re-runs KOT generation on CONFIRMED |
| Cancel order (staff) | Working | Blocks PAID orders |
| Cancel public order | Working | 2-minute window enforced |
| Order tracking (customer JWT) | Working | Customer ownership checked |
| Digital receipt | Working | Returns full order + payments |
| Auto KOT generation | Working | Grouped by departmentId, idempotent |
| Inventory auto-deduct | Working | Triggered on SERVED/PAID, non-blocking |
| Delivery address validation | Working | Required when orderType = DELIVERY |
| Add-ons in order | Working | Addon price computed per item |

### Kitchen/KOT Module — `apps/api/src/kitchen/`
| Feature | Status | Notes |
|---|---|---|
| Departments CRUD | Working | Branch-scoped, soft delete |
| List KOT tickets (filtered) | Working | branchId + status + departmentId filters |
| Get single KOT | Working | Full items with menuItem name and addon info |
| Create KOT manually | Working | Groups by department |
| Auto KOT from order creation | Working | Called from OrdersService, non-blocking |
| Update KOT status | Working | Emits WebSocket event to kitchen room |
| Update KOT item status | Working | Sets startedAt/completedAt timestamps |
| Real-time KOT via WebSocket | Working | `kot.created`, `kot.status_changed`, `kot.item_updated` |

### Tables Module — `apps/api/src/tables/`
| Feature | Status | Notes |
|---|---|---|
| Table CRUD | Working | Soft delete, QR code auto-generated |
| Table status update | Working | Emits WebSocket event |
| Floor plan layout fields | Working | posX, posY, width, height, shape stored |
| Table merge | Working | Moves items to primary order, cancels secondary, frees table |
| Table transfer | Working | Updates both old and new table statuses |
| Public table info | Working | Returns restaurant slug + theme for QR landing page |
| QR code generation | Working | Uses `qrcode` npm package, returns data URL |

### Customers Module — `apps/api/src/customers/`
| Feature | Status | Notes |
|---|---|---|
| List/search customers | Working | name + phone search, insensitive |
| Get customer + orders | Working | Full order history |
| Create customer | Working | Duplicate phone check (ConflictException) |
| Update customer | Working | Phone change uniqueness re-checked |
| Soft delete customer | Working | isActive = false |
| Loyalty points field | Working | Stored in schema, not auto-calculated |

### Inventory Module — `apps/api/src/inventory/`
| Feature | Status | Notes |
|---|---|---|
| Inventory item CRUD | Working | Branch-scoped, soft delete |
| Low stock alert | Working | Returns items where currentStock ≤ minStock |
| Stock adjustment (manual) | Working | RESTOCK/MANUAL_DEDUCTION/WASTE/ORDER_DEDUCTION types |
| Insufficient stock guard | Working | BadRequestException if new stock < 0 |
| Adjustment history | Working | Last 50 adjustments per item |
| BOM/Ingredients CRUD | Working | Link inventory items to menu items with quantity |
| Auto-deduct on order served | Working | Sums quantities across items, deducts per ingredient |

### Shifts Module — `apps/api/src/shifts/`
| Feature | Status | Notes |
|---|---|---|
| Open shift | Working | ConflictException if shift already open |
| Close shift with summary | Working | Calculates totalCollected, cashCollected, variance |
| Get active shift | Working | Returns null if none open |
| List shift history | Working | Last 30 shifts |
| Get shift summary | Working | byMethod breakdown, order count |
| Real-time shift events | Working | `shift.opened`, `shift.closed` emitted to branch room |

### Reservations Module — `apps/api/src/reservations/`
| Feature | Status | Notes |
|---|---|---|
| CRUD reservations | Working | branchId + tableId + date/status filters |
| Reservation status flow | Working | UPCOMING→SEATED→COMPLETED/CANCELLED/NO_SHOW |
| Socket event on SEATED | Working | Emits `reservation.seated` to branch room |

### Employees Module — `apps/api/src/employees/`
| Feature | Status | Notes |
|---|---|---|
| List employees (with branch) | Working | Optional branchId filter |
| Create employee | Working | bcrypt hash, email uniqueness check |
| Update employee | Working | name/role/branchId/isActive |
| Deactivate employee | Working | Soft delete |

### Settings Module — `apps/api/src/settings/`
| Feature | Status | Notes |
|---|---|---|
| Get/update restaurant | Working | name, logoUrl, themeColor |
| Branch CRUD | Working | Create/update/list |
| Staff CRUD (via Settings) | Working | Overlaps with Employees module |

### Analytics Module — `apps/api/src/analytics/`
| Feature | Status | Notes |
|---|---|---|
| Summary widget | Working | totalRevenue, totalOrders, todayRevenue, todayOrders |
| Daily revenue (30 days) | Working | Grouped by YYYY-MM-DD |
| Popular items (top 10) | Working | Grouped by quantity |
| Orders by status | Working | Pie chart data |
| Daily P&L | Working | Revenue, tax, discount, byPaymentMode |
| Reports: today-sales | Working | Returns total + revenue |
| Reports: daywise | Working | Revenue per day in range |
| Reports: item-wise | Working | Qty + revenue per menu item |
| Reports: payment-modes | Working | Amount per mode |
| Reports: cancelled | Working | List of cancelled orders |
| Reports: customer-data | Working | Top 20 customers by spend |
| Reports: repeated-customers | Working | Customers with >1 order |
| Reports: employee-sales | Working | Order count + revenue per staff |
| Reports: time-wise | Working | Revenue per hour (IST) |
| Reports: monthwise | Working | Revenue per month |
| IST timezone handling | Working | startOfDayIST/endOfDayIST helpers |

### Payments Module — `apps/api/src/payments/`
| Feature | Status | Notes |
|---|---|---|
| Record payment | Working | CASH/CARD/UPI/ONLINE/WALLET |
| Auto-mark order PAID | Working | When totalPaid ≥ orderTotal |
| Split bill calculation | Working | Per-item assignment with tax proportioning |
| Refund payment | Working | Marks original REFUNDED, creates reverse record, recalculates paymentStatus |
| Payment events | Working | `payment.created`, `payment.completed` via WebSocket |

### AI Module — `apps/api/src/ai/`
| Feature | Status | Notes |
|---|---|---|
| AI dining assistant chat | Working | GPT-4o-mini if OPENAI_API_KEY set |
| Mock fallback | Working | Returns top 3 items when no API key |
| Menu context injection | Working | Loads up to 50 available items into system prompt |

### Events/WebSocket — `apps/api/src/events/`
| Feature | Status | Notes |
|---|---|---|
| JWT auth on connect | Working | Disconnects unauthenticated clients |
| join:branch room | Working | Staff join branch room |
| join:kitchen room | Working | Kitchen staff join kitchen room |
| join:order room | Working | Customers join order tracking room |
| Emit helpers | Working | emitToKitchen, emitToBranch, emitToOrder, emitToRoom |
| CORS on WebSocket | Partial | Only reads single CORS_ORIGIN, comma-split not applied here |

### Admin UI — `apps/admin/src/app/(dashboard)/`
| Page | Status | Notes |
|---|---|---|
| Dashboard (`/`) | Working | Analytics summary, 6 stat cards |
| Analytics (`/analytics`) | Working | Charts, P&L, 6 report types |
| POS (`/pos`) | Working | Full POS with cart, variants, discount, GST, split bill, pay later |
| Orders (`/orders`) | Working | Order list with pagination, status filters |
| Orders receipt (`/orders/[id]/receipt`) | Working | Printable receipt page |
| Kitchen (`/kitchen`) | Working | 3-column Kanban, dept filter, live WebSocket, auto-refresh |
| Tables (`/tables`) | Working | Table management UI |
| Menu (`/menu`) | Working | Menu categories + items management |
| Customers (`/customers`) | Working | Customer list + search |
| Inventory (`/inventory`) | Working | Inventory items + stock adjustment |
| Shifts (`/shifts`) | Working | Open/close shift, history, cash variance |
| Reservations (`/reservations`) | Working | Reservation list + create/update |
| Employees (`/employees`) | Working | Employee list + create/deactivate |
| Settings (`/settings`) | Working | Restaurant + branch + staff management |

### Customer Web — `apps/customer-web/src/app/`
| Page | Status | Notes |
|---|---|---|
| Home (`/`) | Working | Landing page |
| Table landing (`/table/[tableId]`) | Working | QR code entry point — loads restaurant info |
| Menu (`/menu/[restaurantId]`) | Working | Full menu browse with cart |
| Order tracking (`/order/[orderId]`) | Working | Real-time order status via WebSocket |

---

## 2. Bug Fix Report

| Bug ID | Description | Status | Fix Location |
|---|---|---|---|
| BUG-001 | customerLogin P2003 FK error when restaurantId invalid | Fixed | `auth.service.ts:144` — restaurant existence check before Customer upsert |
| BUG-002 | Order number P2002 unique constraint collision | Fixed | `orders.service.ts:313` — retry on P2002 |
| BUG-003 | Decimal serialization sending strings to frontend | Fixed | All services use `Number()` conversion in serialize helpers |
| BUG-004 | KOT auto-generation duplicating items on repeated calls | Fixed | `kitchen.service.ts:129` — idempotency via alreadyKotted Set |
| BUG-005 | forbidNonWhitelisted=false allows extra body fields | Open | `main.ts:14` — set to false; should be true for strict input |
| BUG-006 | WebSocket CORS only accepts single origin | Partial | `events.gateway.ts:17` — does not split CORS_ORIGIN for WS |
| BUG-007 | Auth module registers APP_GUARD twice (JwtAuthGuard + RolesGuard) | Open | `auth.module.ts:26-31` — both registered, but AppModule also has ThrottlerGuard as APP_GUARD — risk of guard conflict |
| BUG-008 | QR code URL hardcoded fallback to local IP | Open | `tables.service.ts:186` — `http://192.168.0.109:3003` hardcoded as fallback |
| BUG-009 | Inventory auto-deduct does not guard against negative stock | Open | `inventory.service.ts:182` — `decrement` can go below 0 in auto-deduct path |
| BUG-010 | Shift close calculates payments from restaurant-wide, not branch | Open | `shifts.service.ts:83` — no branchId filter on payments query |

---

## 3. Testing Report (Code Review Based)

### Auth — PASS
- Controller covers: login, refresh, logout, /me, change-password, customer-login
- DTOs: LoginDto has `@IsEmail`, `@MinLength(6)`; RefreshTokenDto has `@IsNotEmpty`
- Service: proper NotFoundException, UnauthorizedException, BadRequestException
- Spec file exists: `auth.service.spec.ts`

### Menu — PASS
- All 20+ endpoints covered
- DTOs have class-validator decorators
- Ownership guards (`assertCategoryOwner`, `assertItemOwner`, etc.) on all mutations
- Error cases: NotFoundException, ForbiddenException, BadRequestException on delete-with-items

### Orders — PASS
- Create validates items array (`ArrayMinSize(1)`)
- Delivery address required check in service
- Transaction used for order + customer stats update
- Edge: empty addonIds array handled
- Missing: no max-items-per-order guard (could create very large orders)

### Kitchen — PASS
- Department CRUD with branch ownership
- KOT creation idempotency guard
- Timestamp tracking (startedAt, completedAt) on item status changes
- DTOs: `@IsEnum` on status fields

### Tables — PASS
- Merge guards: both orders must not be PAID/CANCELLED
- Transfer: target table must be AVAILABLE
- QR code generation wired to CUSTOMER_WEB_URL env

### Customers — PASS
- Duplicate phone: ConflictException on create and on phone change during update
- Soft delete pattern consistent

### Inventory — WARN
- `adjustStock` guards against negative stock for manual adjustments
- `deductForOrder` does **not** guard against negative stock (auto-deduct path)
- No test for concurrent stock deduction race condition
- Spec file exists

### Shifts — WARN
- Close shift payments query has no branchId filter — calculates all restaurant payments since shift open, not just the branch's payments
- Spec file exists

### Analytics — PASS
- All 9 report types implemented and routed via `getReport()`
- IST timezone handling is consistent across all time-based queries
- `getPopularItems` totalRevenue uses base price, not actual order item price (minor accuracy issue for items with variants)

### Payments — PASS
- Transaction used for payment + order status update
- Refund correctly recalculates paymentStatus on the order
- Split bill does proportional tax sharing

### Reservations — PASS
- Full CRUD, status transitions, socket on SEATED

### Employees — PASS
- Create: email uniqueness checked
- Update: only safe fields (name/role/branchId/isActive)
- No endpoint to reset password for an employee (admin use case missing)

### Settings — PASS
- Branch CRUD, staff CRUD (duplicate of Employees module)
- Both Settings and Employees modules manage users — functional but redundant

### AI — PASS
- Graceful fallback when OPENAI_API_KEY missing
- Graceful fallback on API error
- System prompt limits to 50 menu items to avoid token overflow

---

## 4. Production Readiness Report

### Security Review

| Check | Status | Notes |
|---|---|---|
| CORS origin configurable | Yes | `CORS_ORIGIN` env var, comma-split supported for HTTP |
| CORS for WebSocket | Partial | WebSocket gateway uses raw `CORS_ORIGIN` string, no comma-split |
| JWT secret required at boot | Yes | `jwt.strategy.ts` throws if `JWT_SECRET` not set |
| JWT secret hardcoded fallback | RISK | `auth.module.ts:16` — `fallback-secret` used if JWT_SECRET missing during module init |
| Refresh token DB-backed | Yes | Session table, expiry enforced |
| Global validation pipe | Yes | `whitelist: true` strips unknown fields |
| `forbidNonWhitelisted` | Off | Set to `false` in main.ts — should be `true` for production |
| Body size limit | Default | No explicit body limit set — NestJS default is 100kb |
| Rate limiting | Yes | ThrottlerModule: 100 req / 60s per IP |
| SQL injection via Prisma | Protected | Prisma ORM parameterizes all queries |
| Password hashing | Yes | bcrypt with cost 10 |
| Sensitive fields excluded | Yes | `passwordHash` never returned in API responses |
| Role guards registered globally | Yes | Both JwtAuthGuard and RolesGuard as APP_GUARD |
| Swagger disabled in production | Yes | `NODE_ENV !== 'production'` check |

### Performance Review

| Check | Status | Notes |
|---|---|---|
| DB indexes on hot queries | Yes | `Order[restaurantId,status]`, `Order[restaurantId,createdAt]`, `Session[token]`, `MenuCategory[restaurantId]`, `MenuItem[restaurantId,isAvailable]`, `KOTTicket[branchId,status]` |
| Pagination implemented | Yes | Orders list: page/limit with metadata |
| N+1 risk: KOT list | Low | Items included in single query via Prisma `include` |
| N+1 risk: getPopularItems | Present | Two queries (groupBy + findMany) but no loop |
| N+1 risk: deductForOrder | Present | One DB write per unique inventory item in a loop (non-blocking) |
| N+1 risk: analytics reports | Low | Most reports load all matching orders then reduce in JS |
| listOrders includes all items | Present | Full item list returned on every order in list — could be heavy for large result sets |
| WebSocket connection auth | Per-connection | JWT verified on each WS connect |

### Environment Variables

All `process.env` references found:

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes (Prisma) |
| `JWT_SECRET` | Access token signing secret | Yes |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | Yes |
| `JWT_EXPIRES_IN` | Access token TTL (default: 15m) | Optional |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (default: 30d) | Optional |
| `CORS_ORIGIN` | Allowed HTTP origins (comma-separated) | Optional (default: localhost:3000) |
| `CUSTOMER_WEB_URL` | Used for QR code URL generation | Optional (default: hardcoded local IP) |
| `PORT` | HTTP server port (default: 3001) | Optional |
| `HOST` | HTTP bind address (default: 0.0.0.0) | Optional |
| `NODE_ENV` | Disables Swagger in production | Optional |
| `OPENAI_API_KEY` | AI chat feature | Optional (graceful fallback) |

No `.env.example` file found in the repository.

### Build Status

- TypeScript project with NestJS + Next.js
- Prisma schema is clean with no obvious TS errors visible in source
- One known workaround: `analytics.service.ts:262` — `this.prisma.orderItem.groupBy as any` cast to avoid Prisma circular-type TS bug (runtime correct)
- `qrcode` module loaded via `require()` at runtime in `tables.service.ts:191` — should be a proper import

### Deployment Readiness Checklist

| Item | Status |
|---|---|
| DATABASE_URL env documented | No `.env.example` |
| JWT_SECRET env set | Required — no default fallback enforced at runtime startup (fallback string in auth.module) |
| Production CORS origins configured | Needs CORS_ORIGIN |
| Swagger disabled in prod | Yes — NODE_ENV guard |
| Health check endpoint | No — not implemented |
| Database migrations tracked | Yes — Prisma migrations |
| Seed script | Yes — `apps/api/prisma/seed.ts` exists |
| Body size limits | Not configured |
| Error logging | Yes — HttpExceptionFilter + PrismaExceptionFilter |
| Zero-downtime restart | Not configured (no PM2/k8s config) |
| Docker / container config | Not found in repo |

---

## 5. Pending Tasks Report

| Priority | Task | Effort | Notes |
|---|---|---|---|
| P0 | Fix `forbidNonWhitelisted: false` → `true` in `main.ts` | XS | Security — allows arbitrary body fields through |
| P0 | Fix JWT_SECRET fallback string in `auth.module.ts` | XS | `fallback-secret` used if env not set — silent security hole |
| P0 | Fix QR code URL hardcoded fallback (`192.168.0.109`) | XS | Replace with proper env var requirement |
| P0 | Add health check endpoint (`/health`) | S | Required for load balancers and container orchestration |
| P1 | Fix shift close to filter payments by branchId | XS | `shifts.service.ts:83` — currently sums all restaurant payments |
| P1 | Guard auto-deduct against negative stock | S | `inventory.service.ts` deductForOrder needs stock check |
| P1 | Add `.env.example` file | S | Document all required/optional environment variables |
| P1 | Fix WebSocket CORS to support comma-split origins | XS | `events.gateway.ts` — parse CORS_ORIGIN same as HTTP |
| P1 | Add employee password reset endpoint | S | Admin use case — currently only self-change supported |
| P2 | Add explicit body size limit (`bodyParser` limit) | XS | Prevent large payload attacks |
| P2 | Fix `qrcode` require() to proper import | XS | `tables.service.ts:190` |
| P2 | Customer Web: AI chat UI not found | M | `ai.controller.ts` exists but no customer-facing chat page |
| P2 | Admin: No department management UI | M | Kitchen departments CRUD API exists, no admin page |
| P2 | Admin: No inventory ingredients/BOM UI | M | API exists (`/inventory/:id/ingredients`), no UI |
| P2 | Admin: No QR code print page | S | `getQRCode` endpoint exists, no dedicated print UI |
| P2 | Admin: Analytics missing 3 report types in UI | S | `repeated-customers`, `employee-sales`, `time-wise`, `monthwise` not in UI tabs |
| P3 | CRM / Loyalty program | L | Schema has `loyaltyPoints` field but no earn/redeem logic |
| P3 | Delivery management module | L | OrderType.DELIVERY exists but no delivery tracking/driver UI |
| P3 | Accounting / expense tracking | XL | Not started |
| P3 | HR / Payroll module | XL | Not started — employees exist but no payroll |
| P3 | Customer Web: Delivery address input | M | OrderType DELIVERY possible but no delivery address field in customer web |
| P3 | Multi-restaurant / SaaS onboarding | L | Restaurant model exists but no self-signup flow |
| P3 | Add `@IsNotEmpty` to change-password body params | XS | `auth.controller.ts:63` — raw `@Body()` params with no DTO validation |
| P3 | Image upload for menu items / restaurant logo | L | `imageUrl` field exists but upload endpoint not found |
| Tech Debt | Consolidate Settings/Employees modules | M | Both manage User records — creates confusion |
| Tech Debt | Add request logging middleware | S | Currently no structured request/response logging |
| Tech Debt | Add unit tests for TablesService (merge/transfer) | M | Complex logic with no spec file found |
| Tech Debt | Add E2E tests | XL | No Playwright/Supertest E2E tests found |
| Tech Debt | Docker Compose for local dev | M | No containerization config found |
| Tech Debt | `getPopularItems` revenue calculation uses base price | S | Should use actual `OrderItem.totalPrice` for accuracy with variants |
| Tech Debt | Orders list response includes full items array | M | Consider summary-only list + detail-on-demand pattern for performance |
| Tech Debt | AI chat: no message history persistence | M | Chat is stateless — no conversation history stored |
| Doc | API documentation beyond Swagger | M | No developer/operator docs |
| Doc | Deployment guide | M | No DEPLOY.md or infrastructure docs |

---

## Summary

**Core platform is functionally complete** for a restaurant POS + kitchen management system. All 14 backend modules are implemented with proper ownership guards, error handling, and real-time WebSocket events. All 14 admin UI pages are implemented. The customer web has the full QR-order flow.

Key gaps before production deployment:
1. Two security issues: JWT_SECRET fallback string + `forbidNonWhitelisted: false`
2. Missing health check endpoint
3. No `.env.example` — operational risk
4. Hardcoded IP in QR code fallback
5. Shift summary bug (branchId not filtered)

Phase 3B features (Loyalty, Delivery, Accounting, HR/Payroll) are not started.

---

## PRODUCTION READY: NO

**Blockers:**
1. `auth.module.ts:16` — JWT_SECRET fallback string (`"fallback-secret"`) is a critical security misconfiguration that would silently sign tokens with a known secret if the env var is missing.
2. `main.ts:14` — `forbidNonWhitelisted: false` allows arbitrary extra fields through validation — should be `true`.
3. No health check endpoint — required for any container/load-balancer deployment.
4. No `.env.example` — operational teams cannot deploy without documentation.
5. `tables.service.ts:186` — QR code URL hardcoded to `http://192.168.0.109:3003` as fallback.

All 5 blockers are small fixes (< 1 hour total). After those are resolved and `.env.example` is created, the platform is functionally ready for a production pilot.
