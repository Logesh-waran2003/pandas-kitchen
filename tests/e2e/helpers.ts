import { Page, expect } from "@playwright/test"

export const API = "http://localhost:3001/api/v1"
export const ADMIN_URL = "http://localhost:3000"
export const CUSTOMER_URL = "http://localhost:3003"

export const SEEDS = {
  staffEmail: "admin@pandaskitchen.com",
  staffPassword: "admin123",
  restaurantSlug: "pandas-kitchen",
  branchId: "main-branch",
  coupon: "WELCOME20",
  custPhone: "9876543210",
  custName: "Test Customer",
}

// ── API helpers (fetch-based, no browser needed) ─────────────────────────────
export async function apiStaffLogin(): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SEEDS.staffEmail, password: SEEDS.staffPassword }),
  })
  const data = await res.json()
  if (!data.accessToken) throw new Error(`Staff login failed: ${JSON.stringify(data)}`)
  return data.accessToken
}

export async function apiGetRestaurantId(token: string): Promise<string> {
  const res = await fetch(`${API}/settings/restaurant`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return data.id
}

export async function apiGetRestaurantIdBySlug(): Promise<string> {
  const res = await fetch(`${API}/settings/restaurant/${SEEDS.restaurantSlug}/public`)
  const data = await res.json()
  return data.id
}

export async function apiGetFirstMenuItem(restaurantId: string): Promise<{ id: string; name: string; price: number; addonGroups: any[] }> {
  const res = await fetch(`${API}/menu/public/${restaurantId}`)
  const data = await res.json()
  const item = data.categories[0]?.items[0]
  if (!item) throw new Error("No menu items in seed data")
  return item
}

// ── Browser helpers ───────────────────────────────────────────────────────────
export async function adminLogin(page: Page) {
  await page.goto(`${ADMIN_URL}/login`)
  await page.getByPlaceholder(/email/i).fill(SEEDS.staffEmail)
  await page.getByPlaceholder(/password/i).fill(SEEDS.staffPassword)
  await page.getByRole("button", { name: /login|sign in/i }).click()
  await expect(page).toHaveURL(/dashboard|orders|pos/, { timeout: 8000 })
}

export async function setCustomerSession(page: Page, name: string, phone: string) {
  await page.evaluate(([n, p]) => {
    sessionStorage.setItem("pk-identity", JSON.stringify({ name: n, phone: p }))
  }, [name, phone])
}

export async function getCartCount(page: Page): Promise<number> {
  const badge = page.locator("[aria-label='Open cart'] span, button:has(svg) span").first()
  const text = await badge.textContent().catch(() => "0")
  return parseInt(text ?? "0", 10) || 0
}
