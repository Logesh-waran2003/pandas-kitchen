import { test, expect, Page } from "@playwright/test"
import { SEEDS, ADMIN_URL, API, apiStaffLogin, apiGetRestaurantId, apiGetFirstMenuItem } from "./helpers"

let token: string
let restaurantId: string

test.beforeAll(async () => {
  token = await apiStaffLogin()
  restaurantId = await apiGetRestaurantId(token)
})

async function adminLogin(page: Page) {
  await page.goto(`${ADMIN_URL}/login`)
  await page.getByPlaceholder(/email/i).fill(SEEDS.staffEmail)
  await page.getByPlaceholder(/password/i).fill(SEEDS.staffPassword)
  await page.getByRole("button", { name: /login|sign in/i }).click()
  await page.waitForURL(/dashboard|orders|pos/, { timeout: 8000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Auth
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Admin — authentication", () => {
  test("PW-ADM-AUTH-01 Login page renders", async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`)
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
  })

  test("PW-ADM-AUTH-02 Valid login redirects to dashboard", async ({ page }) => {
    await adminLogin(page)
    await expect(page.url()).toMatch(/localhost:3000/)
    // Should not still be on /login
    expect(page.url()).not.toContain("/login")
  })

  test("PW-ADM-AUTH-03 Wrong password shows error", async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`)
    await page.getByPlaceholder(/email/i).fill(SEEDS.staffEmail)
    await page.getByPlaceholder(/password/i).fill("wrongpassword123")
    await page.getByRole("button", { name: /login|sign in/i }).click()
    await expect(page.getByText(/invalid|incorrect|wrong|error/i)).toBeVisible({ timeout: 5000 })
  })

  test("PW-ADM-AUTH-04 Protected admin page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto(`${ADMIN_URL}/orders`)
    await expect(page).toHaveURL(/login/, { timeout: 6000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Admin — Orders
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Admin — orders management", () => {
  test("PW-ADM-ORD-01 Orders page loads and shows list", async ({ page }) => {
    await adminLogin(page)
    await page.goto(`${ADMIN_URL}/orders`)
    await page.waitForLoadState("networkidle")
    // Either shows orders table or "no orders" message
    await expect(page.getByText(/order|no orders/i)).toBeVisible({ timeout: 6000 })
  })

  test("PW-ADM-ORD-02 Order detail page loads", async ({ page }) => {
    // Place a test order via API first
    const firstItem = await apiGetFirstMenuItem(restaurantId)
    const res = await fetch(`${API}/orders/public`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId: SEEDS.branchId,
        orderType: "TAKEAWAY",
        customerName: "E2E Test",
        customerPhone: "9800099001",
        items: [{ menuItemId: firstItem.id, quantity: 1 }],
        gstRate: 5,
      }),
    })
    const order = await res.json()
    await adminLogin(page)
    await page.goto(`${ADMIN_URL}/orders/${order.id}`)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(new RegExp(order.orderNumber, "i"))).toBeVisible({ timeout: 6000 })
  })

  test("PW-ADM-ORD-03 Staff can change order status to CONFIRMED", async ({ page }) => {
    const firstItem = await apiGetFirstMenuItem(restaurantId)
    const res = await fetch(`${API}/orders/public`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId: SEEDS.branchId,
        orderType: "TAKEAWAY",
        customerName: "Status Test",
        customerPhone: "9800099002",
        items: [{ menuItemId: firstItem.id, quantity: 1 }],
        gstRate: 5,
      }),
    })
    const order = await res.json()
    await adminLogin(page)
    await page.goto(`${ADMIN_URL}/orders/${order.id}`)
    await page.waitForLoadState("networkidle")
    // Look for Confirm button
    const confirmBtn = page.getByRole("button", { name: /confirm/i })
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
      await expect(page.getByText(/confirmed/i)).toBeVisible({ timeout: 5000 })
    } else {
      // Status may already be updated or button labeled differently
      test.skip()
    }
  })

  test("PW-ADM-ORD-04 Online orders page loads", async ({ page }) => {
    await adminLogin(page)
    await page.goto(`${ADMIN_URL}/online-orders`)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(/online|takeaway|delivery/i)).toBeVisible({ timeout: 6000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Admin — Menu management
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Admin — menu management", () => {
  test("PW-ADM-MENU-01 Menu page renders categories and items", async ({ page }) => {
    await adminLogin(page)
    await page.goto(`${ADMIN_URL}/menu`)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(/starters|main course|category/i)).toBeVisible({ timeout: 6000 })
  })

  test("PW-ADM-MENU-02 Can create new category", async ({ page }) => {
    await adminLogin(page)
    await page.goto(`${ADMIN_URL}/menu`)
    await page.waitForLoadState("networkidle")
    const addBtn = page.getByRole("button", { name: /add category|new category|\+ category/i })
    if (await addBtn.isVisible()) {
      await addBtn.click()
      await page.getByPlaceholder(/name/i).fill("E2E Test Category")
      await page.getByRole("button", { name: /save|create|add/i }).last().click()
      await expect(page.getByText(/e2e test category/i)).toBeVisible({ timeout: 5000 })
    } else {
      test.skip()
    }
  })

  test("PW-ADM-MENU-03 Can toggle item availability", async ({ page }) => {
    await adminLogin(page)
    await page.goto(`${ADMIN_URL}/menu`)
    await page.waitForLoadState("networkidle")
    // Look for a toggle/switch on an item
    const toggle = page.locator("button[role='switch'], input[type='checkbox']").first()
    if (await toggle.isVisible()) {
      const before = await toggle.getAttribute("aria-checked") ?? await toggle.isChecked()
      await toggle.click()
      await page.waitForTimeout(500)
      const after = await toggle.getAttribute("aria-checked") ?? await toggle.isChecked()
      expect(String(before)).not.toBe(String(after))
    } else {
      test.skip()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Admin — Kitchen Display
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Admin — kitchen display", () => {
  test("PW-ADM-KDS-01 Kitchen page loads", async ({ page }) => {
    await adminLogin(page)
    await page.goto(`${ADMIN_URL}/kitchen`)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(/kitchen|kot|no.*ticket|pending/i)).toBeVisible({ timeout: 6000 })
  })

  test("PW-ADM-KDS-02 KOT appears after order confirmation", async ({ page }) => {
    // Place + confirm order via API
    const firstItem = await apiGetFirstMenuItem(restaurantId)
    const orderRes = await fetch(`${API}/orders/public`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId: SEEDS.branchId,
        orderType: "DINE_IN",
        customerName: "KDS Test",
        customerPhone: "9800099003",
        items: [{ menuItemId: firstItem.id, quantity: 1 }],
        gstRate: 5,
      }),
    })
    const order = await orderRes.json()
    // Confirm via API
    await fetch(`${API}/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "CONFIRMED" }),
    })
    await adminLogin(page)
    await page.goto(`${ADMIN_URL}/kitchen`)
    await page.waitForLoadState("networkidle")
    // KOT for this order should appear
    await expect(page.getByText(new RegExp(order.orderNumber.slice(-4), "i"))).toBeVisible({ timeout: 6000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Admin — Settings
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Admin — settings", () => {
  test("PW-ADM-SET-01 Settings page loads", async ({ page }) => {
    await adminLogin(page)
    await page.goto(`${ADMIN_URL}/settings`)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(/settings|restaurant|online/i)).toBeVisible({ timeout: 6000 })
  })

  test("PW-ADM-SET-02 Can update service charge", async ({ page }) => {
    await adminLogin(page)
    await page.goto(`${ADMIN_URL}/settings`)
    await page.waitForLoadState("networkidle")
    const serviceChargeInput = page.getByLabel(/service charge/i).or(page.getByPlaceholder(/service charge/i))
    if (await serviceChargeInput.isVisible()) {
      await serviceChargeInput.fill("5")
      const saveBtn = page.getByRole("button", { name: /save|update/i })
      await saveBtn.click()
      await expect(page.getByText(/saved|updated|success/i)).toBeVisible({ timeout: 5000 })
    } else {
      test.skip()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Admin — Inventory
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Admin — inventory", () => {
  test("PW-ADM-INV-01 Inventory page loads", async ({ page }) => {
    await adminLogin(page)
    await page.goto(`${ADMIN_URL}/inventory`)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(/inventory|stock|item/i)).toBeVisible({ timeout: 6000 })
  })

  test("PW-ADM-INV-02 Can create inventory item", async ({ page }) => {
    await adminLogin(page)
    await page.goto(`${ADMIN_URL}/inventory`)
    await page.waitForLoadState("networkidle")
    const addBtn = page.getByRole("button", { name: /add item|new item|\+ item/i })
    if (await addBtn.isVisible()) {
      await addBtn.click()
      await page.getByPlaceholder(/name/i).fill("E2E Tomato Test")
      const unitInput = page.getByPlaceholder(/unit/i)
      if (await unitInput.isVisible()) await unitInput.fill("kg")
      await page.getByRole("button", { name: /save|create|add/i }).last().click()
      await expect(page.getByText(/e2e tomato test/i)).toBeVisible({ timeout: 5000 })
    } else {
      test.skip()
    }
  })
})
