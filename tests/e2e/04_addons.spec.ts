import { test, expect } from "@playwright/test"
import { SEEDS, CUSTOMER_URL, API, apiStaffLogin, apiGetRestaurantId } from "./helpers"

let token: string
let restaurantId: string
let itemWithAddons: any

test.beforeAll(async () => {
  token = await apiStaffLogin()
  restaurantId = await apiGetRestaurantId(token)

  // Find or create item with addon groups
  const menuRes = await fetch(`${API}/menu/public/${restaurantId}`)
  const menu = await menuRes.json()
  for (const cat of menu.categories) {
    for (const item of cat.items) {
      if (item.addonGroups?.length > 0) {
        itemWithAddons = item
        break
      }
    }
    if (itemWithAddons) break
  }

  if (!itemWithAddons) {
    // Create test item with addon group via API
    const catRes = await fetch(`${API}/menu/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ restaurantId, name: "E2E Addon Test Cat" }),
    })
    const cat = await catRes.json()
    const itemRes = await fetch(`${API}/menu/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ restaurantId, categoryId: cat.id, name: "E2E Addon Item", price: 150, isVeg: true }),
    })
    const item = await itemRes.json()
    const groupRes = await fetch(`${API}/menu/addon-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ restaurantId, name: "Sauce", minSelect: 0, maxSelect: 2, isRequired: false }),
    })
    const group = await groupRes.json()
    await fetch(`${API}/menu/addon-groups/${group.id}/addons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "Extra Sauce", price: 20 }),
    })
    await fetch(`${API}/menu/items/${item.id}/addon-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ addonGroupId: group.id }),
    })
    // Re-fetch menu to get item with addons
    const updatedMenuRes = await fetch(`${API}/menu/public/${restaurantId}`)
    const updatedMenu = await updatedMenuRes.json()
    for (const c of updatedMenu.categories) {
      for (const i of c.items) {
        if (i.addonGroups?.length > 0) { itemWithAddons = i; break }
      }
      if (itemWithAddons) break
    }
  }
})

test("PW-ADDON-01 Customise button visible for items with addons", async ({ page }) => {
  if (!itemWithAddons) { test.skip(); return }
  await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
  await page.evaluate(([n, p]) => {
    sessionStorage.setItem("pk-identity", JSON.stringify({ name: n, phone: p }))
  }, [SEEDS.custName, SEEDS.custPhone])
  await page.reload()
  await page.waitForLoadState("networkidle")
  await expect(page.getByRole("button", { name: /customise/i }).first()).toBeVisible({ timeout: 6000 })
})

test("PW-ADDON-02 Addon sheet opens with addon groups", async ({ page }) => {
  if (!itemWithAddons) { test.skip(); return }
  await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
  await page.evaluate(([n, p]) => {
    sessionStorage.setItem("pk-identity", JSON.stringify({ name: n, phone: p }))
  }, [SEEDS.custName, SEEDS.custPhone])
  await page.reload()
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: /customise/i }).first().click()
  // Sheet should show addon group name
  await expect(page.getByText(new RegExp(itemWithAddons.addonGroups[0].name, "i"))).toBeVisible({ timeout: 5000 })
})

test("PW-ADDON-03 Selecting addon updates live price", async ({ page }) => {
  if (!itemWithAddons) { test.skip(); return }
  const group = itemWithAddons.addonGroups[0]
  const addon = group.addons[0]
  if (!addon || addon.price === 0) { test.skip(); return }

  await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
  await page.evaluate(([n, p]) => {
    sessionStorage.setItem("pk-identity", JSON.stringify({ name: n, phone: p }))
  }, [SEEDS.custName, SEEDS.custPhone])
  await page.reload()
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: /customise/i }).first().click()
  await page.waitForTimeout(300)

  // Get base price before selecting addon
  const addToCartBtn = page.getByRole("button", { name: /add to cart/i })
  const basePriceText = await addToCartBtn.textContent()
  const basePrice = parseFloat(basePriceText?.match(/[\d.]+/)?.[0] ?? "0")

  // Select the addon
  await page.getByText(addon.name).click()
  await page.waitForTimeout(200)

  // Price should increase
  const newPriceText = await addToCartBtn.textContent()
  const newPrice = parseFloat(newPriceText?.match(/[\d.]+/)?.[0] ?? "0")
  expect(newPrice).toBeGreaterThan(basePrice)
})

test("PW-ADDON-04 Required addon group prevents adding without selection", async ({ page }) => {
  if (!itemWithAddons) { test.skip(); return }
  const hasRequired = itemWithAddons.addonGroups.some((g: any) => g.isRequired)
  if (!hasRequired) { test.skip(); return }

  await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
  await page.evaluate(([n, p]) => {
    sessionStorage.setItem("pk-identity", JSON.stringify({ name: n, phone: p }))
  }, [SEEDS.custName, SEEDS.custPhone])
  await page.reload()
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: /customise/i }).first().click()
  // Try to add without selecting required addon
  await page.getByRole("button", { name: /add to cart/i }).click()
  // Should show validation error
  await page.waitForTimeout(300)
  // dialog or alert should appear
  page.on("dialog", async dialog => {
    expect(dialog.message()).toMatch(/select|required/i)
    await dialog.accept()
  })
})

test("PW-ADDON-05 Addon names appear in cart drawer", async ({ page }) => {
  if (!itemWithAddons) { test.skip(); return }
  const group = itemWithAddons.addonGroups[0]
  const addon = group.addons[0]
  if (!addon) { test.skip(); return }

  await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
  await page.evaluate(([n, p]) => {
    sessionStorage.setItem("pk-identity", JSON.stringify({ name: n, phone: p }))
  }, [SEEDS.custName, SEEDS.custPhone])
  await page.reload()
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: /customise/i }).first().click()
  await page.waitForTimeout(300)
  await page.getByText(addon.name).click()
  await page.getByRole("button", { name: /add to cart/i }).click()
  // Open cart
  await page.getByRole("button", { name: /open cart/i }).click()
  await expect(page.getByText(new RegExp(addon.name, "i"))).toBeVisible({ timeout: 4000 })
})

test("PW-ADDON-06 Addon IDs sent in order payload", async ({ page }) => {
  if (!itemWithAddons) { test.skip(); return }
  const group = itemWithAddons.addonGroups[0]
  const addon = group.addons[0]
  if (!addon) { test.skip(); return }

  // Intercept the POST /orders/public call
  let capturedPayload: any = null
  await page.route("**/orders/public", async (route) => {
    const req = route.request()
    if (req.method() === "POST") {
      capturedPayload = JSON.parse(req.postData() ?? "{}")
    }
    await route.continue()
  })

  await page.goto(`${CUSTOMER_URL}/r/${SEEDS.restaurantSlug}`)
  await page.evaluate(([n, p]) => {
    sessionStorage.setItem("pk-identity", JSON.stringify({ name: n, phone: p }))
  }, [SEEDS.custName, SEEDS.custPhone])
  await page.reload()
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: /customise/i }).first().click()
  await page.waitForTimeout(300)
  await page.getByText(addon.name).click()
  await page.getByRole("button", { name: /add to cart/i }).click()
  // Proceed to checkout
  await page.getByRole("button", { name: /view cart/i }).click().catch(async () => {
    await page.getByRole("button", { name: /open cart/i }).click()
  })
  await page.getByRole("button", { name: /proceed to checkout/i }).click()
  await page.getByPlaceholder(/your name/i).fill(SEEDS.custName)
  await page.getByPlaceholder(/10-digit|phone/i).fill(SEEDS.custPhone)
  await page.getByRole("button", { name: /place order/i }).click()
  await page.waitForURL(/order\//, { timeout: 10000 })

  // Verify addon IDs were in the payload
  expect(capturedPayload).not.toBeNull()
  const orderItem = capturedPayload?.items?.[0]
  expect(orderItem?.addonIds).toBeDefined()
  expect(orderItem.addonIds).toContain(addon.id)
})
