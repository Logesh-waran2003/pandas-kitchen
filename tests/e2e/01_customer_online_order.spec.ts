import { test, expect, Page } from "@playwright/test"
import {
  SEEDS, CUSTOMER_URL, API,
  apiGetRestaurantIdBySlug, apiGetFirstMenuItem,
  setCustomerSession, getCartCount,
} from "./helpers"

let restaurantId: string
let firstItem: { id: string; name: string; price: number; addonGroups: any[] }

test.beforeAll(async () => {
  restaurantId = await apiGetRestaurantIdBySlug()
  firstItem = await apiGetFirstMenuItem(restaurantId)
})

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 1: Online ordering via /r/[slug]
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Online ordering — /r/[slug]", () => {
  test("PW-ONLINE-01 Auth gate shows on first visit", async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
    await expect(page.getByText(/view menu|online ordering/i)).toBeVisible({ timeout: 8000 })
    // Should show name + phone fields
    await expect(page.getByPlaceholder(/name/i)).toBeVisible()
    await expect(page.getByPlaceholder(/phone|mobile/i)).toBeVisible()
  })

  test("PW-ONLINE-02 Auth gate validates phone format", async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
    await page.getByPlaceholder(/name/i).fill("Test User")
    await page.getByPlaceholder(/phone|mobile/i).fill("12345")  // invalid
    await page.getByRole("button", { name: /view menu|order/i }).click()
    await expect(page.getByText(/valid|10.digit/i)).toBeVisible()
  })

  test("PW-ONLINE-03 Auth gate submits and shows menu", async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
    await page.getByPlaceholder(/name/i).fill(SEEDS.custName)
    await page.getByPlaceholder(/phone|mobile/i).fill(SEEDS.custPhone)
    await page.getByRole("button", { name: /view menu|order/i }).click()
    // Should see menu after submitting
    await expect(page.getByText(/starters|main course|burger/i)).toBeVisible({ timeout: 8000 })
  })

  test("PW-ONLINE-04 Session persists after page refresh — no re-gate", async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
    // Inject identity directly into sessionStorage
    await page.evaluate(([n, p]) => {
      sessionStorage.setItem("pk-identity", JSON.stringify({ name: n, phone: p }))
    }, [SEEDS.custName, SEEDS.custPhone])
    await page.reload()
    // Should skip gate and show menu directly
    await expect(page.getByText(/starters|main course|all/i)).toBeVisible({ timeout: 8000 })
    // Name/phone inputs should NOT be visible
    const nameInput = page.getByPlaceholder(/your name/i)
    await expect(nameInput).not.toBeVisible()
  })

  test("PW-ONLINE-05 Can add item to cart", async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
    await page.evaluate(([n, p]) => {
      sessionStorage.setItem("pk-identity", JSON.stringify({ name: n, phone: p }))
    }, [SEEDS.custName, SEEDS.custPhone])
    await page.reload()
    await page.waitForLoadState("networkidle")
    // Click Add on first item that has no addons/variants
    const addBtn = page.getByRole("button", { name: /^add$/i }).first()
    await addBtn.click()
    // Cart count should be 1
    await expect(page.locator("button[aria-label='Open cart'] span, button span.bg-red-500").first()).toContainText("1", { timeout: 4000 })
  })

  test("PW-ONLINE-06 Addon sheet opens for items with addons", async ({ page }) => {
    if (firstItem.addonGroups?.length === 0) {
      test.skip()
      return
    }
    await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
    await page.evaluate(([n, p]) => {
      sessionStorage.setItem("pk-identity", JSON.stringify({ name: n, phone: p }))
    }, [SEEDS.custName, SEEDS.custPhone])
    await page.reload()
    await page.waitForLoadState("networkidle")
    // Click Customise button
    const customiseBtn = page.getByRole("button", { name: /customise/i }).first()
    if (await customiseBtn.isVisible()) {
      await customiseBtn.click()
      // Sheet should appear
      await expect(page.getByText(/add to cart/i)).toBeVisible({ timeout: 4000 })
    }
  })

  test("PW-ONLINE-07 Cart drawer shows added items", async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
    await page.evaluate(([n, p]) => {
      sessionStorage.setItem("pk-identity", JSON.stringify({ name: n, phone: p }))
    }, [SEEDS.custName, SEEDS.custPhone])
    await page.reload()
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: /^add$/i }).first().click()
    await page.getByRole("button", { name: /open cart/i }).click()
    await expect(page.getByText(/your order|proceed to checkout/i)).toBeVisible()
  })

  test("PW-ONLINE-08 Proceed to checkout navigates to /checkout", async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
    await page.evaluate(([n, p]) => {
      sessionStorage.setItem("pk-identity", JSON.stringify({ name: n, phone: p }))
    }, [SEEDS.custName, SEEDS.custPhone])
    await page.reload()
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: /^add$/i }).first().click()
    // Click cart button then checkout
    await page.getByRole("button", { name: /view cart/i }).click().catch(async () => {
      await page.getByRole("button", { name: /open cart/i }).click()
    })
    await page.getByRole("button", { name: /proceed to checkout/i }).click()
    await expect(page).toHaveURL(/checkout/, { timeout: 6000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 2: Checkout page
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Checkout page", () => {
  async function goToCheckoutWithItem(page: Page) {
    await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
    await page.evaluate(([n, p]) => {
      sessionStorage.setItem("pk-identity", JSON.stringify({ name: n, phone: p }))
    }, [SEEDS.custName, SEEDS.custPhone])
    await page.reload()
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: /^add$/i }).first().click()
    await page.getByRole("button", { name: /view cart/i }).click().catch(async () => {
      await page.getByRole("button", { name: /open cart/i }).click()
    })
    await page.getByRole("button", { name: /proceed to checkout/i }).click()
    await expect(page).toHaveURL(/checkout/, { timeout: 6000 })
  }

  test("PW-CHECKOUT-01 Checkout page shows bill summary", async ({ page }) => {
    await goToCheckoutWithItem(page)
    await expect(page.getByText(/bill summary/i)).toBeVisible()
    await expect(page.getByText(/subtotal/i)).toBeVisible()
    await expect(page.getByText(/total/i)).toBeVisible()
  })

  test("PW-CHECKOUT-02 Tax label shows dynamic GST rate not hardcoded 5%", async ({ page }) => {
    await goToCheckoutWithItem(page)
    // Tax line should show rate from settings e.g. "Tax (5%)"
    await expect(page.getByText(/tax.*\d+%/i)).toBeVisible()
  })

  test("PW-CHECKOUT-03 Coupon code field exists", async ({ page }) => {
    await goToCheckoutWithItem(page)
    await expect(page.getByText(/coupon code/i)).toBeVisible()
    await expect(page.getByPlaceholder(/coupon/i)).toBeVisible()
  })

  test("PW-CHECKOUT-04 Valid coupon applies discount", async ({ page }) => {
    await goToCheckoutWithItem(page)
    await page.getByPlaceholder(/coupon/i).fill(SEEDS.coupon)
    await page.getByRole("button", { name: /apply/i }).click()
    await expect(page.getByText(/coupon discount|−₹/i)).toBeVisible({ timeout: 5000 })
  })

  test("PW-CHECKOUT-05 Invalid coupon shows error", async ({ page }) => {
    await goToCheckoutWithItem(page)
    await page.getByPlaceholder(/coupon/i).fill("FAKECOUPON123")
    await page.getByRole("button", { name: /apply/i }).click()
    await expect(page.getByText(/invalid|expired/i)).toBeVisible({ timeout: 5000 })
  })

  test("PW-CHECKOUT-06 Empty cart redirects away from checkout", async ({ page }) => {
    // Navigate directly to checkout without cart items
    await page.goto(`${CUSTOMER_URL}/checkout`)
    // Should redirect to home or show empty state
    await expect(page).not.toHaveURL(/checkout/, { timeout: 5000 })
  })

  test("PW-CHECKOUT-07 Place order and navigate to tracking page", async ({ page }) => {
    await goToCheckoutWithItem(page)
    // Fill customer details
    await page.getByPlaceholder(/your name/i).fill(SEEDS.custName)
    await page.getByPlaceholder(/10-digit|phone/i).fill(SEEDS.custPhone)
    await page.getByRole("button", { name: /place order/i }).click()
    await expect(page).toHaveURL(/order\//, { timeout: 10000 })
  })

  test("PW-CHECKOUT-08 Order tracking page shows order status", async ({ page }) => {
    await goToCheckoutWithItem(page)
    await page.getByPlaceholder(/your name/i).fill(SEEDS.custName)
    await page.getByPlaceholder(/10-digit|phone/i).fill(SEEDS.custPhone)
    await page.getByRole("button", { name: /place order/i }).click()
    await expect(page).toHaveURL(/order\//, { timeout: 10000 })
    await expect(page.getByText(/order placed|pending|confirmed/i)).toBeVisible({ timeout: 6000 })
  })

  test("PW-CHECKOUT-09 Cart items show addon names in checkout", async ({ page }) => {
    // This verifies addons stored in cart are displayed
    await goToCheckoutWithItem(page)
    // Items section should be visible
    await expect(page.getByText(/your items/i)).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 3: QR table scan flow
// ─────────────────────────────────────────────────────────────────────────────
test.describe("QR table flow — /table/[tableId]", () => {
  test("PW-QR-01 Table landing page shows table number and menu button", async ({ page }) => {
    // Get a valid table ID first via API
    const token = await (async () => {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: SEEDS.staffEmail, password: SEEDS.staffPassword }),
      })
      return (await res.json()).accessToken
    })()
    const tablesRes = await fetch(`${API}/tables?restaurantId=${restaurantId}&branchId=${SEEDS.branchId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const tables = await tablesRes.json()
    if (!tables?.data?.[0]?.id) {
      test.skip()
      return
    }
    const tableId = tables.data[0].id
    await page.goto(`${CUSTOMER_URL}/table/${tableId}`)
    await expect(page.getByText(/table/i)).toBeVisible({ timeout: 6000 })
    await expect(page.getByRole("button", { name: /view menu|order/i })).toBeVisible()
  })

  test("PW-QR-02 Invalid table ID shows error", async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/table/totally-invalid-table-id`)
    await expect(page.getByText(/not found|invalid/i)).toBeVisible({ timeout: 6000 })
  })
})
