# Pandas Kitchen — Production Readiness Report
**Date:** 2026-07-28  
**Scope:** Phase 1 + Phase 2 (no Phase 3 features)  
**Reviewer:** Architecture + QA audit (Donna)

---

## Browser Smoke Test Results

| Page | Status | Notes |
|------|--------|-------|
| Login | PASS | Auth flow, redirect to dashboard |
| Dashboard | PASS | 6 stat cards, analytics/summary loading |
| Menu | PASS | Two-panel CRUD, categories + items |
| Orders | PASS | Status tabs, list, create order modal |
| POS | PASS | Category filter, variant modal, cart, GST calc, order placement |
| Tables | PASS | 3 tables render, status dropdowns, Add/Edit/Delete present |
| Kitchen | PASS | KOT board renders, live timer, status transitions |
| Customers | PASS | Table list, search, order history drawer |
| Analytics | PASS | Summary cards, charts (empty data set) |

POS full flow verified: selected "Test Burger → Large (₹299)", GST auto-calculated to ₹313.95, "Place Order + Pay" placed order, cart cleared cleanly. Tables inline status change confirmed functional via React onChange handler.

---

## Bugs (Confirmed, Reproducible)

### CRITICAL

**BUG-01: Analytics totalCustomers counts staff, not customers**
File: `apps/api/src/analytics/analytics.service.ts:15`
```ts
// WRONG — counts User (staff) records
this.prisma.user.count({ where: { restaurantId } })

// CORRECT
this.prisma.customer.count({ where: { restaurantId, isActive: true } })
```
The dashboard "Customers" stat card shows staff headcount, not customer count.

**BUG-02: Customer order history — `totalAmount` is always undefined**
File: `apps/api/src/customers/customers.service.ts:55-68`
`getCustomerOrders` maps manually and returns `total: Number(o.total)` but does NOT add the `totalAmount` alias that `serializeOrder` does. The frontend `CustomerOrder` interface expects `totalAmount`. Result: formatCurrency renders `₹0.00` for all past orders in the customer drawer.
Fix: add `totalAmount: Number(o.total)` to the map or reuse `serializeOrder`.

**BUG-03: Payment double-refund — no idempotency guard**
File: `apps/api/src/payments/payments.service.ts:74`
`refundPayment` does not check if the payment is already in `REFUNDED` status before proceeding. Calling it twice on the same payment ID creates two refund records and recalculates order payment status twice. Add status guard:
```ts
if (payment.status === 'REFUNDED') {
  throw new BadRequestException('Payment already refunded')
}
```

**BUG-04: Customer totalOrders / totalSpent never updated**
Schema has `totalOrders Int @default(0)` and `totalSpent Decimal @default(0)` on Customer. Neither `orders.service.ts` createOrder nor any other mutation increments these. They will always show 0. Either compute them live (preferred) or update on order create/payment.

---

### HIGH

**BUG-05: No DTO validation — all Phase 2 endpoints accept any input**
`ValidationPipe` is not registered globally. DTOs only carry `@ApiProperty` (Swagger docs), no `class-validator` decorators. The only validated endpoint is `auth/login` (Zod in service). Every other POST/PATCH accepts arbitrary payloads:
- CreateOrderDto: `quantity` could be 0, -1, or string
- CreatePaymentDto: `amount` could be negative
- CreateTableDto: `tableNumber` could be empty string
- CreateCustomerDto: `phone` has no format/length validation

Fix: install `class-validator` + `class-transformer`, add `useGlobalPipes(new ValidationPipe({ whitelist: true }))` in main.ts, add decorators to all DTOs.

**BUG-06: `discountType` stored as nullable String, not enum**
Schema: `discountType String?` on Order. The service passes `dto.discountType ?? "FLAT"`. No enum enforcement at DB level — typos persist silently.

**BUG-07: Order number collision risk**
`ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}` — 4-digit suffix gives 9000 possible values per millisecond tick. Under concurrent load (multiple cashiers), collisions are possible. No unique constraint on `orderNumber` in schema. Fix: add `@@unique([orderNumber])` in schema and use a sequential counter or ULID.

**BUG-08: Session table never purged**
Every login creates a `Session` row. Refresh rotates tokens but old sessions are never deleted. No cleanup job. A high-volume restaurant will accumulate millions of rows within months. Add a scheduled cleanup or delete expired sessions on login:
```ts
await this.prisma.session.deleteMany({
  where: { userId: user.id, expiresAt: { lt: new Date() } }
})
```

---

### MEDIUM

**BUG-09: `gstAmount` and `tax` are redundant, both store the same value**
`apps/api/src/orders/orders.service.ts:182-183` sets both `tax: gstAmt` and `gstAmount: gstAmt`. Schema has both fields. Pick one canonical field and remove the other to avoid future inconsistency.

**BUG-10: Hard delete of MenuCategory cascades with no guard**
`menuService.deleteCategory` calls `prisma.menuCategory.delete()`. If items exist Prisma throws P2003 (FK violation) which the PrismaExceptionFilter catches as 400 with a generic message. This confuses the user. Add a pre-check:
```ts
const count = await this.prisma.menuItem.count({ where: { categoryId: id } })
if (count > 0) throw new BadRequestException(`Cannot delete category with ${count} items`)
```
Same pattern applies to MenuItem hard delete — order history references it.

**BUG-11: Analytics `startOfToday()` is not timezone-aware**
`new Date(); d.setHours(0,0,0,0)` uses server/process timezone. If the server runs UTC (typical for cloud) but the restaurant is IST (+5:30), "today revenue" will be off by 5.5 hours. Fix: pass timezone in the request or compute start-of-day in a timezone-aware way using `date-fns-tz`.

**BUG-12: ThrottlerModule registered but ThrottlerGuard not applied**
`app.module.ts` imports `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` but no `APP_GUARD` provider for `ThrottlerGuard` is added. Rate limiting is completely inactive. Add:
```ts
{ provide: APP_GUARD, useClass: ThrottlerGuard }
```

---

### LOW

**BUG-13: POS page heading renders "Pos" not "POS"**
`apps/admin/src/app/(dashboard)/layout.tsx` title-cases the segment name. POS renders as "Pos". Fix the label map.

**BUG-14: Tables page brief flash of "Select a branch" before branches load**
Initial `selectedBranchId` is empty string until `branches` loads and the first `useEffect` sets it. For ~200ms on first render, tables show "Select a branch". Fix: initialize with a loading state rather than the empty string guard.

**BUG-15: `where: any` type usage in 4 services**
`orders.service.ts`, `customers.service.ts`, `kitchen.service.ts`, `analytics.service.ts` all use `const where: any = {}` for building Prisma queries. Defeats TypeScript. Use Prisma's generated `Prisma.OrderWhereInput` etc.

---

## Security Issues

**SEC-01: CORS set to `origin: "*"`** (CRITICAL for production)
`main.ts:13` allows any origin. An attacker can host a page that makes authenticated requests using a victim's browser session. Before deploying, restrict to known frontend domains.

**SEC-02: JWT fallback secrets in code**
`jwt.strategy.ts`: `secretOrKey: process.env.JWT_SECRET ?? "fallback-secret"`
`jwt-refresh.strategy.ts`: `secretOrKey: process.env.JWT_REFRESH_SECRET ?? "fallback-refresh-secret"`
If the env vars are missing, the app silently uses known hardcoded secrets. Tokens signed with "fallback-secret" are trivially forgeable. Change to throw on missing secret:
```ts
secretOrKey: (() => {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET not set')
  return s
})()
```

**SEC-03: No request body size limit**
NestJS/Fastify defaults allow large bodies. Without a size cap, the API is vulnerable to DOS via large payloads (e.g., an order with thousands of items). Add `bodyLimit` in Fastify options or use the `@nestjs/platform-express` body parser limit.

**SEC-04: Passwords in bcrypt with rounds=10 — acceptable for now**
Rounds of 10 is the library default and fine. Document it explicitly so it's a conscious choice not an accident.

**SEC-05: `.env` in repo root — verify `.gitignore`**
Both `apps/api/.env` and `apps/admin/.env.local` exist. Confirm `.gitignore` excludes them. The provided `.env.example` is good practice, keep it.

---

## Performance Issues

**PERF-01: Missing database indexes on high-query columns**

Current indexes: Session(token), Session(userId), Customer(restaurantId_phone unique), Customer(restaurantId).

Missing:
```prisma
model Order {
  @@index([restaurantId, status])
  @@index([restaurantId, createdAt])
  @@index([branchId])
}
model MenuItem {
  @@index([restaurantId, isAvailable])
  @@index([categoryId])
}
model MenuCategory {
  @@index([restaurantId])
}
model KOTTicket {
  @@index([branchId, status])
}
model Payment {
  @@index([orderId])
  @@index([restaurantId])
}
```
The analytics summary runs 6 parallel queries across `Order` — without indexes on `restaurantId+status+createdAt` these will full-scan at scale.

**PERF-02: Analytics `getPopularItems` does N+1 pattern**
`orderItem.groupBy` returns menuItemIds, then a second `menuItem.findMany`. Fine for now but watch at scale. Consider a materialized view or periodic caching.

**PERF-03: POS loads all menu items on initial render**
`/menu/items` returns all items without pagination. A restaurant with 500 items will load all 500 on POS open. Add `take`/`skip` or a `search` query param to the items endpoint.

**PERF-04: Kitchen KOT polling (if used) has no debounce**
The Kitchen page has a manual refresh button. If auto-polling is added later (Phase 3), ensure debouncing — repeated PATCH calls on KOT status already show as a pattern.

---

## Architecture Review

### What's good
- Clean NestJS module separation — each domain (menu, orders, tables, customers, kitchen, payments) is self-contained
- Prisma with proper transaction usage in payments and order creation
- Owner-scoping pattern (`assertCategoryOwner`, `assertItemOwner`) is consistent and correct
- Exception filters are clean and cover Prisma errors properly
- Decimal arithmetic via `@prisma/client/runtime/library` Decimal — correct, avoids float math errors
- Zustand + localStorage persistence for auth is appropriate for SPA
- `serializeOrder` as a single canonical serializer for order shapes is the right call

### What needs improvement

**1. No global ValidationPipe (see BUG-05)**
This is the biggest architectural gap. All DTOs are decoration-only right now.

**2. DTOs have no runtime validation schema**
The project mixes two validation approaches: Zod in `auth.service.ts`, and nothing elsewhere. Pick one and apply consistently. Recommendation: use `class-validator` globally (standard NestJS) and remove the manual Zod schema from auth.

**3. Services directly read `process.env`**
`auth.service.ts` calls `process.env.JWT_SECRET` inside `login()` on every request. Should be injected via `ConfigService` at construction time.

**4. `packages/types` and `packages/ui` are empty shells**
`packages/types/src/index.ts` and `packages/ui/src/index.ts` export nothing useful. The frontend and backend define their own interfaces independently — there is no shared type contract. Phase 3 should populate `packages/types` with shared Order, Customer, MenuItem interfaces consumed by both API and admin.

**5. Customer aggregate fields (totalOrders, totalSpent) are denormalized but not maintained**
Either remove these from the schema and compute on-the-fly, or maintain them with DB triggers / transactional updates. Right now they're lying in the schema unused, which is worse than either option.

**6. No structured logging**
`console.log` only in bootstrap. NestJS has a built-in Logger. Add request logging middleware for debugging production issues.

---

## Test Cases

### Unit Tests (write these first — highest value)

**auth.service.spec.ts**
```
- login: valid credentials → returns accessToken + refreshToken + user shape
- login: invalid password → throws UnauthorizedException
- login: inactive user → throws UnauthorizedException
- login: invalid email format → throws BadRequestException (Zod)
- refresh: valid refreshToken → returns new accessToken
- refresh: expired session → throws UnauthorizedException
- refresh: nonexistent refreshToken → throws UnauthorizedException
- logout: valid token → deletes session
- me: valid userId → returns user without passwordHash
```

**orders.service.spec.ts**
```
- createOrder: 2 items, no discount → subtotal = sum of line totals
- createOrder: flat discount 10 → total reduced by exactly 10
- createOrder: percent discount 10% → total reduced by 10% of subtotal
- createOrder: GST 5% → gstAmount = 5% of (subtotal - discount + serviceCharge)
- createOrder: variant selected → uses variant price not base price
- createOrder: addon selected → addon price added to line total
- createOrder: empty items array → throws BadRequestException
- createOrder: invalid menuItemId → throws NotFoundException
- createOrder: variant belongs to different item → throws NotFoundException
- cancelOrder: PAID order → throws BadRequestException (or verify allowed statuses)
```

**payments.service.spec.ts**
```
- createPayment: amount < order total → paymentStatus = PARTIAL
- createPayment: amount = order total → paymentStatus = PAID, order status = PAID
- createPayment: amount > order total → paymentStatus = PAID (overpayment allowed)
- refundPayment: valid → creates REFUNDED record, recalculates order paymentStatus
- refundPayment: already refunded → throws BadRequestException [BUG-03 regression test]
- refundPayment: wrong restaurant → throws ForbiddenException
```

**analytics.service.spec.ts**
```
- getSummary: totalCustomers uses customer model not user model [BUG-01 regression]
- getSummary: cancelled orders excluded from revenue
- getSummary: todayRevenue only includes today's orders (UTC boundary test)
- getDailyRevenue: groups by YYYY-MM-DD correctly
- getPopularItems: sorted by quantity descending
```

**menu.service.spec.ts**
```
- deleteCategory: has items → throws BadRequestException [BUG-10 regression]
- deleteCategory: no items → succeeds
- toggleItemAvailability: available → unavailable, unavailable → available
- createItem: category belongs to different restaurant → throws ForbiddenException
```

---

### Integration Tests

**POST /auth/login → GET /auth/me → POST /auth/refresh → POST /auth/logout**
Full token lifecycle. Verify session count before and after logout.

**POST /orders → PATCH /orders/:id/status → POST /payments**
Order create → status to SERVED → payment → verify paymentStatus=PAID.

**POST /menu/categories → POST /menu/items → DELETE /menu/categories (with items)**
Verify BUG-10 fix: delete with items returns 400 with helpful message.

**POST /customers → GET /customers/:id/orders**
Create customer → place order with customerId → verify order appears in history with correct totalAmount [BUG-02 regression].

---

### Manual Smoke Tests (run these after every deploy)

**POS Full Flow**
1. Navigate to /pos
2. Select a category → verify items filter
3. Search for an item by name → verify search works
4. Click item with variant → verify VariantModal opens
5. Select variant → verify item added to cart with variant price
6. Increase quantity → verify total updates
7. Apply % discount → verify total recalculates
8. Change GST % → verify tax line updates
9. Select table from dropdown → verify tableId sent in payload
10. Click "Place Order + Pay" → verify success toast, cart clears
11. Navigate to Orders → verify new order appears with correct total

**Tables Full Flow**
1. Navigate to /tables
2. Switch branch (if multiple) → verify table list reloads
3. Change a table status via dropdown → verify badge color updates, API call fires
4. Click "Add Table" → fill form → verify new card appears
5. Click edit icon → change capacity → verify updated
6. Click delete → verify table removed from list (soft delete)

**Kitchen Flow**
1. Place an order via POS
2. Navigate to /kitchen
3. Verify KOT ticket appears
4. Click "Start" → verify status changes to IN_PROGRESS
5. Click "Complete" → verify ticket moves to completed state

**Customer History**
1. Create customer via /customers
2. Place order with that customer selected in POS
3. Open customer detail drawer → verify order appears
4. Verify `totalAmount` shows correct value (not ₹0.00) [BUG-02]

---

## Prioritized Recommendations

### Ship blockers (fix before any production traffic)
1. **BUG-01** — Analytics customer count is wrong. Wrong number on the dashboard is embarrassing on day one.
2. **SEC-01** — CORS wildcard. Lock it down.
3. **SEC-02** — Remove JWT fallback secrets. Make missing env var a hard crash at startup.
4. **BUG-05** — Add global ValidationPipe + class-validator decorators on all DTOs. Unvalidated input is a data integrity time bomb.
5. **BUG-03** — Payment double-refund guard. One line of code, prevents financial corruption.

### Fix before first real customer
6. **BUG-02** — Customer order history shows ₹0.00. Will confuse staff immediately.
7. **BUG-04** — Customer totalOrders/totalSpent always 0. Decide: compute live or maintain.
8. **BUG-08** — Session table will grow unbounded. Add cleanup at login.
9. **PERF-01** — Add the missing DB indexes. Run migrations before load hits.
10. **BUG-10** — Category delete with items should give a clean error, not a generic 400.

### Nice to have before scale
11. **PERF-03** — Paginate menu items endpoint (POS will feel sluggish at 200+ items)
12. **BUG-11** — Timezone-aware startOfToday for analytics
13. **BUG-07** — Order number uniqueness constraint
14. **BUG-12** — Actually enable the ThrottlerGuard (it's registered but not active)
15. **SEC-03** — Body size limit

---

## Summary Verdict

**Architecture:** Solid foundation. Module boundaries are clean, Prisma usage is correct, transaction handling in payments is good. The main gap is that validation infrastructure exists (pipes file present) but isn't wired up — one global registration would close the biggest security/integrity hole.

**Production readiness:** Not ready. Five blockers (CORS, JWT secrets, validation, analytics bug, payment double-refund) need to be addressed. Estimated fix time: 1 focused day.

**Test coverage:** Currently zero automated tests. The unit test cases above cover the highest-risk business logic. Start with auth + orders + payments service tests — those cover the money path.
