"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronLeft, Tag, X, Star } from "lucide-react"
import { useCartStore } from "@/stores/cart.store"
import OrderTypeSelector from "@/components/OrderTypeSelector"
import { fetchOnlineSettings, OnlineSettings } from "@/lib/online-settings"
import { apiFetch } from "@/lib/api"
import { registerPushAndSubscribe } from "@/lib/push"

const TIP_PRESETS = [0, 10, 20, 30]

function getCustomerAuth(): { token: string; customerId: string; firstName: string } | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("pk-customer-auth")
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function setCustomerAuth(auth: { token: string; customerId: string; firstName: string }) {
  localStorage.setItem("pk-customer-auth", JSON.stringify(auth))
}

export default function CheckoutPage() {
  const router = useRouter()

  const {
    items,
    tableId,
    branchId,
    restaurantId,
    orderType,
    scheduledFor,
    deliveryAddress,
    tip,
    couponCode,
    couponDiscount,
    loyaltyPointsRedeem,
    customerName,
    customerPhone,
    customerEmail,
    total,
    clearCart,
    setScheduledFor,
    setDeliveryAddress,
    setTip,
    applyCoupon,
    clearCoupon,
    setLoyaltyPointsRedeem,
    setCustomerDetails,
  } = useCartStore()

  // Loyalty
  const [loyaltyBalance, setLoyaltyBalance] = useState<{ points: number; valueInRupees: number } | null>(null)
  const [loyaltyApplied, setLoyaltyApplied] = useState(false)

  const [settings, setSettings] = useState<OnlineSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)

  // Schedule
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now")
  const [scheduledInput, setScheduledInput] = useState("")

  // Tip
  const [customTip, setCustomTip] = useState("")
  const [tipMode, setTipMode] = useState<"preset" | "custom">("preset")

  // Coupon
  const [couponInput, setCouponInput] = useState(couponCode ?? "")
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState("")

  // Customer details
  const [nameInput, setNameInput] = useState(customerName ?? "")
  const [phoneInput, setPhoneInput] = useState(customerPhone ?? "")
  const [emailInput, setEmailInput] = useState(customerEmail ?? "")

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "COUNTER">(
    orderType === "DELIVERY" ? "CASH" : "COUNTER"
  )

  // Saved addresses (for DELIVERY autofill)
  const [savedAddresses, setSavedAddresses] = useState<{ id: string; label: string; address: string; isDefault: boolean }[]>([])
  const [showManualAddr, setShowManualAddr] = useState(false)

  // Placing
  const [placing, setPlacing] = useState(false)

  useEffect(() => {
    if (!restaurantId) return
    fetchOnlineSettings(restaurantId)
      .then(setSettings)
      .catch(() => { /* non-fatal */ })
      .finally(() => setSettingsLoading(false))
  }, [restaurantId])

  // Fetch loyalty balance if logged in
  useEffect(() => {
    if (!restaurantId) return
    const auth = getCustomerAuth()
    if (!auth?.token || !auth?.customerId) return
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"
    fetch(`${API_BASE}/customers/me/loyalty-balance/${restaurantId}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setLoyaltyBalance(data) })
      .catch(() => { /* non-fatal */ })
  }, [restaurantId])

  useEffect(() => {
    if (!settingsLoading && items.length === 0) {
      router.replace("/")
    }
  }, [items.length, settingsLoading, router])

  useEffect(() => {
    if (scheduleMode === "now") {
      setScheduledFor(null)
    } else if (scheduledInput) {
      setScheduledFor(new Date(scheduledInput).toISOString())
    }
  }, [scheduleMode, scheduledInput, setScheduledFor])

  // Reset payment method default when order type changes
  useEffect(() => {
    setPaymentMethod(orderType === "DELIVERY" ? "CASH" : "COUNTER")
  }, [orderType])

  // Fetch saved addresses when DELIVERY is selected and user is logged in
  useEffect(() => {
    if (orderType !== "DELIVERY") return
    const auth = getCustomerAuth()
    if (!auth?.token) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"}/customers/me/addresses`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth.token}`,
      },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { id: string; label: string; address: string; isDefault: boolean }[]) => {
        setSavedAddresses(data ?? [])
        // Auto-select the default address
        const def = data?.find((a) => a.isDefault)
        if (def && !deliveryAddress) {
          setDeliveryAddress(def.address)
        }
      })
      .catch(() => { /* non-fatal */ })
  }, [orderType])

  const subtotal = total()
  const gstRate = settings?.gstRate ?? 5
  const serviceCharge = settings
    ? Math.round(subtotal * (settings.serviceChargePercent / 100) * 100) / 100
    : 0
  const deliveryFee = orderType === "DELIVERY" ? (settings?.deliveryFee ?? 0) : 0
  const packagingFee =
    orderType === "TAKEAWAY" || orderType === "DELIVERY"
      ? (settings?.packagingFee ?? 0)
      : 0
  const tax = Math.round(subtotal * (gstRate / 100) * 100) / 100
  const loyaltyDiscount = loyaltyApplied && loyaltyBalance
    ? Math.min(loyaltyBalance.valueInRupees, subtotal)
    : 0
  const grandTotal =
    subtotal + tax + serviceCharge + deliveryFee + packagingFee + tip - couponDiscount - loyaltyDiscount

  function minScheduleDateTime(): string {
    const d = new Date(Date.now() + 30 * 60 * 1000)
    return d.toISOString().slice(0, 16)
  }

  async function handleApplyCoupon() {
    if (!couponInput.trim() || !restaurantId) return
    setCouponError("")
    setCouponLoading(true)
    try {
      const data = await apiFetch<{ valid: boolean; discountAmount: number; message?: string }>(
        `/orders/coupon/${restaurantId}/${couponInput.trim().toUpperCase()}?subtotal=${subtotal}`
      )
      if (!data.valid) {
        setCouponError(data.message ?? "Invalid or expired coupon code")
        clearCoupon()
        return
      }
      applyCoupon(couponInput.trim().toUpperCase(), data.discountAmount)
      toast.success(`Coupon applied! ₹${data.discountAmount.toFixed(2)} off`)
    } catch {
      setCouponError("Invalid or expired coupon code")
      clearCoupon()
    } finally {
      setCouponLoading(false)
    }
  }

  function handleRemoveCoupon() {
    clearCoupon()
    setCouponInput("")
    setCouponError("")
  }

  async function handlePlaceOrder() {
    if (!branchId) { toast.error("Branch info missing — rescan QR"); return }
    if (items.length === 0) { toast.error("Cart is empty"); return }

    const subtotalCheck = total()
    if (settings?.minOrderValue && subtotalCheck < settings.minOrderValue) {
      toast.error(`Minimum order value is ₹${settings.minOrderValue}`)
      return
    }

    if (orderType === "DELIVERY") {
      if (!deliveryAddress?.trim()) { toast.error("Please enter a delivery address"); return }
      if (!nameInput.trim()) { toast.error("Please enter your name"); return }
      if (phoneInput.length < 10) { toast.error("Enter a valid 10-digit phone number"); return }
    }
    if (orderType === "TAKEAWAY") {
      if (!nameInput.trim()) { toast.error("Please enter your name"); return }
      if (phoneInput.length < 10) { toast.error("Enter a valid 10-digit phone number"); return }
    }

    if ((orderType === "TAKEAWAY" || orderType === "DELIVERY") && scheduleMode === "later" && !scheduledInput) {
      toast.error("Please select a time for your scheduled order")
      return
    }

    if (nameInput.trim() || phoneInput) {
      setCustomerDetails(nameInput.trim() || null, phoneInput || null, emailInput.trim() || null)
    }

    let customerId: string | undefined
    const auth = getCustomerAuth()
    if (auth) {
      customerId = auth.customerId
    }
    // Guest orders (no login) are fine — customerId stays undefined

    setPlacing(true)
    try {
      // no tableId = direct online order
      const orderSource = tableId ? "QR_TABLE" : "ONLINE"

      const payload: Record<string, unknown> = {
        branchId,
        tableId: tableId ?? undefined,
        orderType,
        orderSource,
        customerId,
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          variantId: i.variantId ?? undefined,
          addonIds: i.addons && i.addons.length > 0 ? i.addons.map((a) => a.id) : undefined,
          notes: i.notes,
        })),
        tip: tip > 0 ? tip : undefined,
        couponCode: couponCode ?? undefined,
        loyaltyPointsRedeem: loyaltyApplied && loyaltyBalance ? loyaltyBalance.points : undefined,
        deliveryFee: deliveryFee > 0 ? deliveryFee : undefined,
        packagingFee: packagingFee > 0 ? packagingFee : undefined,
        scheduledFor: scheduledFor ?? undefined,
        serviceChargePercent: settings?.serviceChargePercent ?? 0,
        gstRate: settings?.gstRate ?? 5,
      }

      if (orderType === "DELIVERY") {
        payload.deliveryAddress = deliveryAddress
        payload.customerName = nameInput.trim()
        payload.customerPhone = phoneInput
        payload.customerEmail = emailInput.trim() || undefined
      }
      if (orderType === "TAKEAWAY") {
        payload.customerName = nameInput.trim()
        payload.customerPhone = phoneInput
        payload.customerEmail = emailInput.trim() || undefined
      }

      const order = await apiFetch<{
        id: string
        orderNumber: string
        status: string
        total: number
        items: unknown[]
        createdAt: string
      }>("/orders/public", { method: "POST", body: JSON.stringify(payload) })

      if (typeof window !== "undefined") {
        const paymentLabel =
          orderType === "TAKEAWAY"
            ? "Pay at Counter"
            : orderType === "DELIVERY"
            ? "Cash on Delivery"
            : ""
        localStorage.setItem("pk-last-order", JSON.stringify({ ...order, paymentLabel }))
        // Track order history (newest-first, max 20)
        try {
          const prev: string[] = JSON.parse(localStorage.getItem("pk-my-orders") ?? "[]")
          const updated = [order.id, ...prev.filter((id) => id !== order.id)].slice(0, 20)
          localStorage.setItem("pk-my-orders", JSON.stringify(updated))
        } catch { /* non-fatal */ }
      }
      clearCart()
      // Register push notifications for this order (fire and forget)
      registerPushAndSubscribe(order.id).catch(() => {})
      toast.success(`Order ${order.orderNumber} placed! 🎉`)
      router.push(`/order/${order.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to place order")
    } finally {
      setPlacing(false)
    }
  }

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🐼</div>
          <p className="text-gray-500 text-sm">Loading checkout…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Checkout</h1>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Order type */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Order Type
          </h2>
          <OrderTypeSelector
            deliveryEnabled={settings?.deliveryEnabled ?? true}
            takeawayEnabled={settings?.takeawayEnabled ?? true}
          />
        </div>

        {/* Items (readonly) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Your Items
          </h2>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex-1 mr-3">
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  {item.variantName && (
                    <p className="text-xs text-gray-400">{item.variantName}</p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-gray-400 italic">{item.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium">×{item.quantity}</span>
                  <span className="text-sm font-semibold text-orange-600">
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer details */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Your Details
            {orderType === "DINE_IN" && (
              <span className="ml-2 text-xs font-normal normal-case text-gray-400">(optional)</span>
            )}
          </h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Your name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <input
              type="tel"
              placeholder="10-digit phone number"
              inputMode="numeric"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Delivery address */}
        {orderType === "DELIVERY" && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Delivery Address
            </h2>

            {/* Saved addresses dropdown — shown when logged in and addresses exist */}
            {savedAddresses.length > 0 && !showManualAddr && (
              <div className="space-y-2 mb-3">
                <p className="text-xs text-gray-400 font-medium">Saved addresses</p>
                <div className="space-y-2">
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => setDeliveryAddress(addr.address)}
                      className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                        deliveryAddress === addr.address
                          ? "border-orange-500 bg-orange-50"
                          : "border-gray-200 hover:border-orange-300"
                      }`}
                    >
                      <p className="text-xs font-semibold text-gray-700">{addr.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{addr.address}</p>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setShowManualAddr(true); setDeliveryAddress(null) }}
                  className="text-xs text-orange-600 font-medium hover:text-orange-700 transition-colors"
                >
                  Use a different address →
                </button>
              </div>
            )}

            {/* Manual address textarea */}
            {(savedAddresses.length === 0 || showManualAddr) && (
              <>
                {showManualAddr && (
                  <button
                    type="button"
                    onClick={() => setShowManualAddr(false)}
                    className="text-xs text-orange-600 font-medium hover:text-orange-700 transition-colors mb-2 block"
                  >
                    ← Use saved address
                  </button>
                )}
                <textarea
                  rows={3}
                  placeholder="Enter your full delivery address…"
                  value={deliveryAddress ?? ""}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </>
            )}
          </div>
        )}

        {/* Schedule — TAKEAWAY / DELIVERY only */}
        {(orderType === "TAKEAWAY" || orderType === "DELIVERY") && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              When?
            </h2>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setScheduleMode("now")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  scheduleMode === "now"
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                Order Now
              </button>
              <button
                onClick={() => setScheduleMode("later")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  scheduleMode === "later"
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                Schedule for Later
              </button>
            </div>
            {scheduleMode === "later" && (
              <>
                <input
                  type="datetime-local"
                  min={minScheduleDateTime()}
                  value={scheduledInput}
                  onChange={(e) => setScheduledInput(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {scheduledInput && (
                  <p className="text-xs text-orange-600 font-medium mt-2">
                    Your order will be ready at{" "}
                    {new Date(scheduledInput).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })},{" "}
                    {new Date(scheduledInput).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Tip */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Add a Tip
          </h2>
          <div className="flex gap-2 mb-3">
            {TIP_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setTip(preset)
                  setTipMode("preset")
                  setCustomTip("")
                }}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  tipMode === "preset" && tip === preset
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {preset === 0 ? "None" : `₹${preset}`}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="0"
            placeholder="Custom tip amount (₹)"
            value={customTip}
            onFocus={() => setTipMode("custom")}
            onChange={(e) => {
              const val = Math.max(0, Number(e.target.value))
              setCustomTip(e.target.value)
              setTipMode("custom")
              setTip(val)
            }}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Coupon */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Coupon Code
          </h2>
          {couponCode ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700">{couponCode}</span>
                <span className="text-xs text-green-600">−₹{couponDiscount.toFixed(2)}</span>
              </div>
              <button
                onClick={handleRemoveCoupon}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-green-100 transition-colors"
                aria-label="Remove coupon"
              >
                <X className="w-3.5 h-3.5 text-green-600" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase())
                    setCouponError("")
                  }}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase"
                />
                <button
                  onClick={handleApplyCoupon}
                  disabled={!couponInput.trim() || couponLoading}
                  className="bg-orange-500 text-white rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {couponLoading ? "…" : "Apply"}
                </button>
              </div>
              {couponError && (
                <p className="text-xs text-red-500 mt-1.5">{couponError}</p>
              )}
            </>
          )}
        </div>

        {/* Loyalty points */}
        {loyaltyBalance && loyaltyBalance.points > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Loyalty Points
            </h2>
            <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {loyaltyBalance.points} points
                  </p>
                  <p className="text-xs text-gray-500">
                    Worth ₹{loyaltyBalance.valueInRupees.toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setLoyaltyApplied(!loyaltyApplied)
                  setLoyaltyPointsRedeem(loyaltyApplied ? 0 : loyaltyBalance.points)
                }}
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                  loyaltyApplied
                    ? "bg-yellow-500 text-white"
                    : "bg-white border border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                }`}
              >
                {loyaltyApplied ? "Applied ✓" : "Apply"}
              </button>
            </div>
            {loyaltyApplied && (
              <p className="text-xs text-green-600 font-medium mt-2">
                −₹{Math.min(loyaltyBalance.valueInRupees, subtotal).toFixed(2)} discount applied
              </p>
            )}
          </div>
        )}

        {/* Payment method — TAKEAWAY or DELIVERY only */}
        {(orderType === "TAKEAWAY" || orderType === "DELIVERY") && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Payment Method
            </h2>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setPaymentMethod(orderType === "DELIVERY" ? "CASH" : "COUNTER")}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors bg-orange-500 text-white border-orange-500"
              >
                {orderType === "DELIVERY" ? "Cash on Delivery" : "Pay at Counter"}
              </button>
            </div>
          </div>
        )}

        {/* Bill summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Bill Summary
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax ({gstRate}%)</span>
              <span>₹{tax.toFixed(2)}</span>
            </div>
            {serviceCharge > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Service charge ({settings?.serviceChargePercent}%)</span>
                <span>₹{serviceCharge.toFixed(2)}</span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Delivery fee</span>
                <span>₹{deliveryFee.toFixed(2)}</span>
              </div>
            )}
            {packagingFee > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Packaging fee</span>
                <span>₹{packagingFee.toFixed(2)}</span>
              </div>
            )}
            {tip > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tip</span>
                <span>₹{tip.toFixed(2)}</span>
              </div>
            )}
            {couponDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Coupon discount</span>
                <span>−₹{couponDiscount.toFixed(2)}</span>
              </div>
            )}
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between text-sm text-yellow-600">
                <span>Loyalty points</span>
                <span>−₹{loyaltyDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-gray-100 pt-2 flex justify-between text-base font-bold text-gray-900">
              <span>Total</span>
              <span>₹{Math.max(0, grandTotal).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky place order button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-30">
        <button
          onClick={handlePlaceOrder}
          disabled={placing || items.length === 0}
          className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] transition-all text-white rounded-2xl py-4 font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
        >
          {placing && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {placing
            ? "Placing Order…"
            : `${
                orderType === "TAKEAWAY"
                  ? "Place Order (Pay at Counter)"
                  : orderType === "DELIVERY"
                  ? "Place Order (Cash on Delivery)"
                  : "Place Order"
              } · ₹${Math.max(0, grandTotal).toFixed(2)}`}
        </button>
      </div>
    </div>
  )
}
