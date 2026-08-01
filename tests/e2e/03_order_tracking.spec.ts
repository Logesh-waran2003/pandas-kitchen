import { test, expect } from "@playwright/test"
import { SEEDS, CUSTOMER_URL, API, apiStaffLogin, apiGetRestaurantId, apiGetFirstMenuItem } from "./helpers"

let token: string
let restaurantId: string
let testOrderId: string
let testOrderNumber: string

test.beforeAll(async () => {
  token = await apiStaffLogin()
  restaurantId = await apiGetRestaurantId(token)
  const firstItem = await apiGetFirstMenuItem(restaurantId)
  // Place a test order
  const res = await fetch(`${API}/orders/public`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branchId: SEEDS.branchId,
      orderType: "TAKEAWAY",
      customerName: "Tracking Test",
      customerPhone: "9800099010",
      items: [{ menuItemId: firstItem.id, quantity: 1 }],
      gstRate: 5,
    }),
  })
  const order = await res.json()
  testOrderId = order.id
  testOrderNumber = order.orderNumber
})

test("PW-TRACK-01 Order tracking page loads with order details", async ({ page }) => {
  await page.goto(`${CUSTOMER_URL}/order/${testOrderId}`)
  await expect(page.getByText(new RegExp(testOrderNumber, "i"))).toBeVisible({ timeout: 8000 })
})

test("PW-TRACK-02 Order status stepper is visible", async ({ page }) => {
  await page.goto(`${CUSTOMER_URL}/order/${testOrderId}`)
  await expect(page.getByText(/order placed|pending|confirmed/i)).toBeVisible({ timeout: 6000 })
})

test("PW-TRACK-03 Tracking page refresh does not lose order data", async ({ page }) => {
  await page.goto(`${CUSTOMER_URL}/order/${testOrderId}`)
  await page.waitForLoadState("networkidle")
  await page.reload()
  await expect(page.getByText(new RegExp(testOrderNumber, "i"))).toBeVisible({ timeout: 8000 })
})

test("PW-TRACK-04 Cancel button visible for PENDING order within window", async ({ page }) => {
  // Place fresh order for cancel test
  const firstItem = await apiGetFirstMenuItem(restaurantId)
  const res = await fetch(`${API}/orders/public`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branchId: SEEDS.branchId,
      orderType: "TAKEAWAY",
      customerName: "Cancel Track Test",
      customerPhone: "9800099011",
      items: [{ menuItemId: firstItem.id, quantity: 1 }],
      gstRate: 5,
    }),
  })
  const order = await res.json()
  await page.goto(`${CUSTOMER_URL}/order/${order.id}`)
  await expect(page.getByRole("button", { name: /cancel/i })).toBeVisible({ timeout: 6000 })
})

test("PW-TRACK-05 Status updates via socket reflected in UI", async ({ page }) => {
  // Place order, confirm it via API, check UI updates
  const firstItem = await apiGetFirstMenuItem(restaurantId)
  const orderRes = await fetch(`${API}/orders/public`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branchId: SEEDS.branchId,
      orderType: "DINE_IN",
      customerName: "Socket Test",
      customerPhone: "9800099012",
      items: [{ menuItemId: firstItem.id, quantity: 1 }],
      gstRate: 5,
    }),
  })
  const order = await orderRes.json()
  await page.goto(`${CUSTOMER_URL}/order/${order.id}`)
  await page.waitForLoadState("networkidle")
  // Confirm order via API while page is open
  await fetch(`${API}/orders/${order.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: "CONFIRMED" }),
  })
  // Socket should update the UI within 5 seconds
  await expect(page.getByText(/confirmed/i)).toBeVisible({ timeout: 8000 })
})

test("PW-TRACK-06 Takeaway order shows pickup code", async ({ page }) => {
  const firstItem = await apiGetFirstMenuItem(restaurantId)
  const res = await fetch(`${API}/orders/public`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branchId: SEEDS.branchId,
      orderType: "TAKEAWAY",
      customerName: "Pickup Test",
      customerPhone: "9800099013",
      items: [{ menuItemId: firstItem.id, quantity: 1 }],
      gstRate: 5,
    }),
  })
  const order = await res.json()
  // Confirm so pickupCode is generated
  await fetch(`${API}/orders/${order.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: "CONFIRMED" }),
  })
  await page.goto(`${CUSTOMER_URL}/order/${order.id}`)
  await expect(page.getByText(/pickup code|counter/i)).toBeVisible({ timeout: 6000 })
})

test("PW-TRACK-07 Invalid order ID shows error not crash", async ({ page }) => {
  await page.goto(`${CUSTOMER_URL}/order/totally-invalid-id-xyz`)
  // Should show error state, not a blank/crashed page
  await page.waitForLoadState("networkidle")
  // Either error message or redirect
  const hasError = await page.getByText(/not found|error|invalid/i).isVisible().catch(() => false)
  const isRedirected = !page.url().includes("totally-invalid-id-xyz")
  expect(hasError || isRedirected).toBeTruthy()
})
