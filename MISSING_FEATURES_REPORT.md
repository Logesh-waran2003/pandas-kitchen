# Pandas Kitchen — Missing Features Report
**Date:** 2026-07-29
**Analyst:** Donna
**Purpose:** What to build next to make this a competitive restaurant ERP

---

## Section 1: Customer Experience Gaps

### 1.1 Real-time Order Tracking
**Priority:** P0 | **Effort:** S
Order tracking page `/order/[orderId]` shows status but never updates live. Customer has to manually refresh.
The WebSocket gateway is already running — just needs the customer web to connect and listen for `order:updated` events.
**Why it matters:** Customer anxiety spike between order placement and food arrival. Every competitor does live tracking.

### 1.2 Call Waiter Button
**Priority:** P0 | **Effort:** S
The order tracking page has a button that shows a toast: "Please call your waiter for assistance." That's not a feature.
Need: Customer taps → WebSocket event fires → Admin tables page shows an alert badge on that table.
**Why it matters:** Core reason for QR-based ordering. Without this, staff still has to walk the floor constantly.

### 1.3 Request Bill Button
**Priority:** P0 | **Effort:** S
No way for customer to signal they're ready to pay. Waiter has to guess or customer has to flag someone down.
Need: "Request Bill" button on order tracking → WebSocket → admin tables shows payment pending badge.
**Why it matters:** Reduces bill wait time, speeds table turn, reduces walkouts.

### 1.4 Allergen Display on Menu
**Priority:** P0 | **Effort:** XS — JUST FIXED**
Was missing, now fixed in this session (commit: fix/allergens-customer-menu).

### 1.5 Dietary Filter
**Priority:** P1 | **Effort:** S
No veg/non-veg filter on customer menu. Customer has to scroll through everything.
Need: Toggle button at top — "Veg Only" — filters items with `isVeg: true`.
**Why it matters:** ~40% of Chennai diners are vegetarian. This is not optional.

### 1.6 Multi-person Table Ordering
**Priority:** P1 | **Effort:** M
4 people scan the same QR → 4 separate orders, 4 KOT tickets, kitchen gets confused.
Need: When table already has an active order, new scan should offer "Add to existing order" or "Start new order".
**Why it matters:** Groups order together. Kitchen sees one ticket per table, not one per person.

### 1.7 Estimated Wait Time
**Priority:** P1 | **Effort:** M
Order tracking shows status but not when food will arrive.
Can calculate avg prep time per item from historical KOT data and show "~15 min" estimate.
**Why it matters:** Biggest anxiety reducer in restaurant UX.

### 1.8 Reorder / Repeat Order
**Priority:** P2 | **Effort:** S
Customer has order history but no one-tap reorder.
Need: "Order again" button on past order → pre-fills cart.
**Why it matters:** Repeat customer retention. High-frequency regulars will use this every visit.

### 1.9 Customer Loyalty / Points
**Priority:** P2 | **Effort:** M
No points-on-spend, no stamp card, no redemption.
Schema needs: `loyaltyPoints` on Customer model, earning rules (e.g. ₹10 = 1 point), redemption at checkout.
**Why it matters:** Core retention mechanic. Petpooja, POSist both have this.

### 1.10 WhatsApp / SMS Receipt
**Priority:** P2 | **Effort:** M
After order is placed, no confirmation sent to customer's phone number.
Need: Twilio/MSG91 integration — send order confirmation + bill to WhatsApp after payment.
**Why it matters:** Customers expect a digital receipt. Also drives repeat visits.

---

## Section 2: Kitchen Operations Gaps

### 2.1 KDS Audio Alert on New Ticket
**Priority:** P0 | **Effort:** S
KDS shows new tickets visually but no sound. In a loud kitchen, staff misses new orders.
Need: Play a short beep on `kot:created` WebSocket event. Browser audio API, no deps needed.
**Why it matters:** Every physical KDS unit beeps. This is table stakes.

### 2.2 Item Notes Visible on KDS
**Priority:** P0 | **Effort:** S
Customer can add per-item notes ("no onion", "extra spicy") at order time. These notes are stored in `OrderItem.notes`.
But the KDS page doesn't display them on the KOT ticket.
**Why it matters:** Kitchen makes the wrong food. Customer complaints.

### 2.3 Printer / Thermal Receipt Integration
**Priority:** P1 | **Effort:** L
No print integration at all. Restaurants need:
- KOT ticket auto-print on order received (kitchen printer)
- Bill print on payment (customer receipt printer)
Need: Browser Print API + HTML receipt template, or direct ESC/POS via a local print agent.
**Why it matters:** 90% of Indian restaurants still use physical KOT slips. This is a blocker for kitchen adoption.

### 2.4 Void / Edit Live Order
**Priority:** P1 | **Effort:** M
Once a KOT is sent to kitchen, there's no way to modify or cancel individual items.
Need: Admin orders page → "Edit" on pending order → remove items, add items, update quantities. KDS reflects change.
**Why it matters:** Customer changes mind within 2 minutes. Without this, kitchen makes wrong food and staff wastes time.

### 2.5 Course Management
**Priority:** P2 | **Effort:** M
All items go to kitchen at once. No way to say "starter first, then main after 15 min."
Need: Order items tagged with course (Starter/Main/Dessert). KDS fires starter KOT immediately, main KOT after starter marked done.
**Why it matters:** Fine dining and mid-range restaurants require this. Without it, dessert arrives with starter.

### 2.6 Table Occupancy Timer
**Priority:** P2 | **Effort:** S
Tables page shows status but not how long the table has been occupied.
Show "Table 3 — Occupied 45min" in KDS and admin tables view.
**Why it matters:** Manager can identify slow tables, optimize turnover.

### 2.7 Kitchen Performance Analytics
**Priority:** P2 | **Effort:** M
No data on avg prep time per item, busiest hours, slowest items.
Need: Track KOT created → completed time, group by item and by hour.
**Why it matters:** Operations optimization. Identify what's slowing the kitchen down.

---

## Section 3: Table Management Gaps

### 3.1 Table Status Not Auto-Updated
**Priority:** P0 | **Effort:** S
Table status (Available/Occupied/Reserved/Cleaning) is manually managed.
When a customer places an order via QR → table should auto-set to OCCUPIED.
When payment is completed → table should auto-set to AVAILABLE (or CLEANING).
Need: Add table status update in `orders.service.ts` on create, and `payments.service.ts` on complete.
**Why it matters:** Floor manager has no real-time view of which tables are actually active.

### 3.2 Floor Plan Visual View
**Priority:** P1 | **Effort:** M
Table x/y coordinates are stored in the DB but the admin tables page is a flat list.
Need: A drag-and-drop floor plan view where tables are positioned visually. Click a table to see its status and active order.
**Why it matters:** Floor managers think in spatial terms. A list is useless in a busy service.

### 3.3 Waiter Assignment per Table
**Priority:** P1 | **Effort:** S
No way to assign a specific staff member to a table.
Need: `assignedUserId` field on Table or Order. Admin can assign. Staff sees only their tables on KDS.
**Why it matters:** Accountability, tips tracking, performance reports.

### 3.4 Reservation → Table Assignment
**Priority:** P1 | **Effort:** S
Reservations exist but when a party arrives, there's no flow to convert reservation → seat at a specific table.
Need: Reservations page → "Seat Now" button → pick table → sets table to RESERVED, links reservation to table.
**Why it matters:** Current reservation system is a digital notepad. It needs to connect to the floor.

### 3.5 Table History
**Priority:** P2 | **Effort:** S
No way to see what happened at a specific table over time.
Need: Table detail view → list of past orders, customers, revenue.
**Why it matters:** Dispute resolution, VIP customer identification ("this is their regular table").

---

## Section 4: Admin / Management Gaps

### 4.1 Dashboard as Action Center
**Priority:** P0 | **Effort:** M
Dashboard is 6 stat cards. A manager arriving at 11am wants to see:
- Are there open orders right now?
- Is a shift open?
- Which tables are occupied?
- Is stock low on anything?
- Are there pending reservations today?

Need: Actionable widgets — active orders count (clickable), low stock alert list, today's reservations, open shift status.
**Why it matters:** Current dashboard is reporting. Managers need operations.

### 4.2 Multi-branch Analytics Breakdown
**Priority:** P1 | **Effort:** M
All analytics roll up to restaurant level. If you have 2 branches, you can't compare them.
Need: Branch filter on analytics page. Revenue/orders/customers per branch.
**Why it matters:** Multi-branch operators make decisions based on branch performance.

### 4.3 Discount Codes / Happy Hour Pricing
**Priority:** P1 | **Effort:** M
No way to apply promotions. No discount codes, no time-based pricing.
Need: Promo code at checkout (% or flat discount), happy hour price rules (item price X between 3-6pm).
**Why it matters:** Every restaurant runs promotions. Without this, manager has to manually edit prices.

### 4.4 Staff Performance Reports
**Priority:** P2 | **Effort:** M
Staff attendance tracked via shifts but no per-staff performance data.
Need: Orders per staff per shift, revenue generated, tables served, avg order value.
**Why it matters:** Manager accountability, incentive calculation.

### 4.5 Customer Feedback / Ratings
**Priority:** P2 | **Effort:** S
No feedback collection. Customer leaves and you have no idea if they were happy.
Need: After order completed, customer web shows a 1-5 star rating prompt + optional comment.
Store on Order model. Show in admin customer detail and analytics.
**Why it matters:** CSAT data. Identify problems before Google Reviews do.

### 4.6 Daily Opening Checklist
**Priority:** P2 | **Effort:** S
No structured opening/closing process.
Need: Configurable checklist (e.g. "Check refrigerator temp, count float, verify stock") that staff marks off each day.
**Why it matters:** SOPs. Especially useful for franchises.

---

## Section 5: Missing ERP Modules

### 5.1 Accounting / GST Reporting
**Priority:** P1 | **Effort:** L
P&L report exists but no GST-compliant tax report for filing.
Need: Monthly GSTR-1 format export (HSN codes, tax collected, invoice-wise). PDF/Excel download.
**Why it matters:** Legal requirement in India. Every restaurant accountant will ask for this.

### 5.2 HR / Payroll
**Priority:** P2 | **Effort:** L
Employees and shifts exist but no payroll calculation.
Need: Staff hourly/monthly rate, attendance from shifts, leave tracking, salary slip generation.
**Why it matters:** Restaurant chains have 10-50 staff. Manual payroll in Excel is error-prone.

### 5.3 Supplier / Purchase Orders
**Priority:** P2 | **Effort:** L
Inventory tracks stock levels but has no procurement flow.
Need: Supplier master, purchase order creation, goods receipt (auto-increases stock), payment to supplier tracking.
**Why it matters:** Closing the inventory loop. Without this, managers buy on WhatsApp and update stock manually.

### 5.4 Waste / Spoilage Logging
**Priority:** P2 | **Effort:** S
No way to record waste. Inventory goes down via sales only.
Need: Waste adjustment type in stock adjustment (alongside MANUAL_ADD/MANUAL_REMOVE). Waste report for the week.
**Why it matters:** Food cost control. Waste is often 15-20% of food cost in poor operations.

### 5.5 Menu Engineering / Profitability
**Priority:** P2 | **Effort:** M
No data on which items are most profitable.
Need: Link item price, BOM cost, and sales volume → profit margin per item. "Stars, Plowhorses, Puzzles, Dogs" classification.
**Why it matters:** Menu design decisions. High-volume low-margin items should be repositioned or repriced.

---

## Section 6: Technical / Infrastructure Gaps

| Gap | Priority | Effort | Notes |
|---|---|---|---|
| Health check endpoint (`GET /health`) | P0 | XS | Needed for load balancer / Docker |
| HTTPS / nginx config | P0 | S | Blocker for production |
| Image upload (S3/local) | P0 | M | URL-only is impractical |
| Password reset (OTP/email) | P1 | M | Staff locked out permanently if forgotten |
| Structured logging (Pino) | P1 | S | console.log not production-grade |
| CI/CD pipeline (GitHub Actions) | P1 | M | No automated test/deploy |
| E2E tests (Playwright) | P2 | L | No browser-level test coverage |
| Push notifications (FCM) | P2 | M | Order status alerts to customer phone |
| Offline POS (service worker) | P2 | L | Network blip kills live orders |
| Shared types package | P2 | S | packages/types empty — API/admin duplicate |

---

## Section 7: UX Improvements

### Customer Web
- **Back button** missing on menu page — only way back is browser back (breaks PWA flow)
- **Cart persists across sessions** — if you close browser and reopen, cart is gone
- **No category count** — customer doesn't know how many items per category before clicking
- **Item images missing** for all seeded items — menu looks sparse without images
- **No "sold out" visual** — unavailable items show in list but with no clear sold-out treatment
- **Phone number login** — asking for phone at checkout kills impulse orders. Consider "Continue as guest"
- **No order confirmation email/SMS** — customer has no record after leaving the page

### Admin POS
- **No keyboard navigation** — fast service needs Tab → item → Enter, not mouse
- **Category doesn't persist** between orders — always resets to first category
- **No quick search** on POS — can't type "burger" to filter items
- **Table selection after cart** — you should pick the table first, not after building the cart
- **No covers/pax count** on POS orders — waiter doesn't input how many people at table

### Admin Kitchen (KDS)
- **No audio on new ticket** — critical in a noisy kitchen
- **Item notes not shown** on ticket — customer's "no onion" request invisible to cook
- **No ticket age colour** — ticket goes yellow at 10min, red at 20min. Currently all same colour regardless of age
- **No "bump" flow** — completed tickets disappear but there's no confirmation bump pattern

### Admin Tables
- **Floor plan view missing** — a list of tables means nothing during busy service
- **No occupancy timer** — how long has Table 4 been sitting?
- **No table action buttons** — clicking a table should show: active order, assign waiter, mark cleaning

### Admin Dashboard
- Replace stat cards with live widgets: active orders queue, occupied tables map, low stock list, today's reservation strip
- Add a quick-action bar: Open Shift, New Reservation, Add Table

### Mobile Responsiveness
- POS page overflows on tablet (scrolls horizontally)
- Tables page list is fine but floor plan view would need touch-drag
- Kitchen KDS works on tablet, but ticket cards are too small on phone
- Analytics charts need responsive sizing

---

## Section 8: Competitive Gaps vs Petpooja / POSist / Torqus

| Feature | Petpooja | POSist | Pandas Kitchen |
|---|---|---|---|
| Thermal printer KOT | Yes | Yes | No |
| Table floor plan | Yes | Yes | No (data exists, no UI) |
| Customer feedback | Yes | Yes | No |
| Loyalty/CRM | Yes | Yes | No |
| GST report | Yes | Yes | No |
| Multi-outlet | Yes | Yes | Partial |
| Online ordering integration (Swiggy/Zomato) | Yes | Yes | No |
| Inventory reorder alerts | Yes | Yes | Only low-stock flag |
| Menu engineering | Petpooja Pro | Yes | No |
| WhatsApp/SMS receipts | Yes | Yes | No |
| Discount engine | Yes | Yes | No |
| Offline mode | Yes (app) | Yes (app) | No |
| KDS audio alerts | Yes | Yes | No |
| Waiter app (mobile) | Yes | Yes | No |

**Key gap:** Petpooja and POSist are native mobile apps. Pandas Kitchen is web-only. For floor staff carrying tablets, this is a significant UX gap — no offline support, no push notifications, no camera access for QR scanning.

---

## Recommended Implementation Roadmap

### Sprint 1 (this week) — Operations Critical
1. Table status auto-update (order placed → OCCUPIED, payment done → AVAILABLE)
2. KDS audio alert on new ticket
3. Item notes visible on KDS tickets
4. Call waiter + Request bill WebSocket flow
5. Real-time order status push to customer tracking page
6. Health check endpoint
7. Veg-only filter on customer menu

### Sprint 2 — Customer Experience
1. Floor plan visual view (tables page)
2. QR print page (admin)
3. Void/edit live order
4. Customer feedback (star rating post-order)
5. Ticket age colour coding on KDS
6. Image upload (S3 presigned URL)

### Sprint 3 — Management
1. Dashboard action center redesign
2. Discount codes / happy hour pricing
3. Multi-branch analytics breakdown
4. GST report (PDF/Excel export)
5. Reservation → table assignment flow
6. Password reset

### Sprint 4 — ERP Depth
1. Thermal printer integration
2. Loyalty / points system
3. Supplier / purchase orders
4. Staff performance reports
5. Menu engineering report
6. CI/CD pipeline

---

**Most impactful single change:** Call Waiter + Request Bill — builds on existing WebSocket infrastructure, takes 2-3 hours, and eliminates the biggest friction point in the customer experience. Do this first.
