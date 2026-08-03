"use client"
import { useEffect, useState, Suspense } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { useCartStore } from "@/stores/cart.store"
import { toast } from "sonner"
import { ShoppingCart, Plus, Minus, Search, X, Leaf, Truck, ShoppingBag, User, LogOut } from "lucide-react"
import ItemDetailSheet, { MenuItemDetail } from "@/components/ItemDetailSheet"
import { useCustomerAuthStore } from "@/stores/customer-auth.store"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }

interface OnlineSettings {
  onlineOrderingEnabled: boolean
  deliveryEnabled: boolean
  takeawayEnabled: boolean
  deliveryFee: number
  packagingFee: number
  serviceChargePercent: number
  minOrderValue: number
}

interface RestaurantPublicInfo {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  themeColor: string | null
  isActive: boolean
  branches: Branch[]
  onlineSettings: OnlineSettings | null
}

interface Category { id: string; name: string }
interface Variant { id: string; name: string; price: number }
interface AddonOption { id: string; name: string; price: number }
interface AddonGroup {
  id: string; name: string
  minSelect: number; maxSelect: number; isRequired: boolean
  addons: AddonOption[]
}
interface MenuItem {
  id: string
  name: string
  description?: string
  price: number
  isVeg: boolean
  isAvailable: boolean
  imageUrl?: string
  categoryId: string
  allergens?: string[]
  variants?: Variant[]
  addonGroups?: AddonGroup[]
}

// ── Session identity helpers ───────────────────────────────────────────────────
function getSessionIdentity(): { name: string; phone: string } | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem("pk-identity")
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function saveSessionIdentity(name: string, phone: string) {
  if (typeof window === "undefined") return
  sessionStorage.setItem("pk-identity", JSON.stringify({ name, phone }))
}

// ── Loading screen ─────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">🐼</div>
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    </div>
  )
}

export default function RestaurantPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RestaurantPageInner />
    </Suspense>
  )
}

function RestaurantPageInner() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()

  const {
    setOnlineContext, setOrderType, items: cartItems, addItem, updateQty,
    updateNote, total, orderType, customerName, customerPhone, setCustomerDetails,
  } = useCartStore()

  // ── Auth gate ──────────────────────────────────────────────────────────────
  // Check sessionStorage first — if they already gave name+phone this session, skip gate
  const sessionIdentity = typeof window !== "undefined" ? getSessionIdentity() : null
  const [gated, setGated] = useState(() => {
    if (typeof window === "undefined") return true
    const identity = getSessionIdentity()
    return !identity && !customerName
  })
  const [gateName, setGateName] = useState(customerName ?? "")
  const [gatePhone, setGatePhone] = useState(customerPhone ?? "")
  const [gateError, setGateError] = useState("")

  function handleGateSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = gateName.trim()
    const phone = gatePhone.trim()
    if (!name) { setGateError("Please enter your name"); return }
    if (!/^[6-9]\d{9}$/.test(phone)) { setGateError("Enter a valid 10-digit mobile number"); return }
    setCustomerDetails(name, phone, null)
    saveSessionIdentity(name, phone)
    setGated(false)
  }

  // ── Restaurant info ────────────────────────────────────────────────────────
  const [info, setInfo] = useState<RestaurantPublicInfo | null>(null)
  const [infoLoading, setInfoLoading] = useState(true)
  const [infoError, setInfoError] = useState<string | null>(null)

  // ── Menu data ──────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [menuLoading, setMenuLoading] = useState(false)

  // ── UI state ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("")
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [vegOnly, setVegOnly] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [expandedNoteItemKey, setExpandedNoteItemKey] = useState<string | null>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  const { clearAuth, isLoggedIn } = useCustomerAuthStore()
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0)

  // ── Restore session identity on mount ─────────────────────────────────────
  useEffect(() => {
    const identity = getSessionIdentity()
    if (identity?.name && identity?.phone) {
      setCustomerDetails(identity.name, identity.phone, null)
      setGated(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 1: fetch restaurant info ──────────────────────────────────────────
  useEffect(() => {
    apiFetch<RestaurantPublicInfo>(`/settings/restaurant/${slug}/public`)
      .then((data) => {
        setInfo(data)
        if (data.branches[0]) setOnlineContext(data.branches[0].id, data.id)
        setOrderType("TAKEAWAY")
      })
      .catch((e) => setInfoError(e instanceof Error ? e.message : "Restaurant not found"))
      .finally(() => setInfoLoading(false))
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 2: fetch menu once we have restaurantId ───────────────────────────
  useEffect(() => {
    if (!info?.id) return
    setMenuLoading(true)
    apiFetch<{
      restaurant: { id: string; name: string }
      categories: Array<{ id: string; name: string; items: MenuItem[] }>
    }>(`/menu/public/${info.id}`)
      .then((data) => {
        setCategories(data.categories.map((c) => ({ id: c.id, name: c.name })))
        setItems(data.categories.flatMap((c) => c.items.map((i) => ({ ...i, categoryId: c.id }))))
      })
      .catch(() => toast.error("Failed to load menu"))
      .finally(() => setMenuLoading(false))
  }, [info?.id])

  // ── Filtered items ─────────────────────────────────────────────────────────
  const filtered = items.filter((i) => {
    const matchCat = !activeCat || i.categoryId === activeCat
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase())
    const matchVeg = !vegOnly || i.isVeg === true
    return matchCat && matchSearch && matchVeg && i.isAvailable
  })

  // ── Item actions ───────────────────────────────────────────────────────────
  function handleItemClick(item: MenuItem) {
    const hasOptions = (item.variants?.length ?? 0) > 0 || (item.addonGroups?.length ?? 0) > 0
    if (!hasOptions) {
      addItem({ menuItemId: item.id, name: item.name, price: item.price, basePrice: item.price, quantity: 1 })
      toast.success(`${item.name} added`)
      return
    }
    setSelectedItem(item)
  }

  function handleAddFromSheet(payload: Parameters<typeof addItem>[0]) {
    addItem(payload)
    const addonSummary = payload.addons && payload.addons.length > 0
      ? ` + ${payload.addons.map(a => a.name).join(", ")}`
      : ""
    toast.success(`${payload.name}${addonSummary} added`)
  }

  function handleCheckout() {
    if (cartItems.length === 0) { toast.error("Cart is empty"); return }
    setCartOpen(false)
    router.push("/checkout")
  }

  // ── Order type toggle helpers ──────────────────────────────────────────────
  const os = info?.onlineSettings
  const canDeliver = os?.deliveryEnabled ?? false
  const canTakeaway = os?.takeawayEnabled ?? true

  // ── Early states ───────────────────────────────────────────────────────────
  if (infoLoading) return <LoadingScreen />

  if (infoError || !info) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Restaurant not found</h2>
          <p className="text-gray-500 text-sm">Check the link and try again.</p>
        </div>
      </div>
    )
  }

  const orderingEnabled = (os?.onlineOrderingEnabled ?? true) && info.isActive

  // ── Auth gate screen ───────────────────────────────────────────────────────
  if (gated) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6">
        {info.logoUrl && (
          <img src={info.logoUrl} alt={info.name} className="w-20 h-20 rounded-full object-cover mb-4 shadow" />
        )}
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg overflow-hidden">
          <div className="bg-orange-500 px-6 py-8 text-center">
            <div className="text-4xl mb-2">🐼</div>
            <h1 className="text-xl font-extrabold text-white">{info.name}</h1>
            <p className="text-orange-100 text-sm mt-1">Online Ordering</p>
          </div>
          <form onSubmit={handleGateSubmit} className="px-6 py-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Your Name
              </label>
              <input
                type="text"
                placeholder="e.g. Rahul Kumar"
                value={gateName}
                onChange={(e) => { setGateName(e.target.value); setGateError("") }}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Mobile Number
              </label>
              <input
                type="tel"
                placeholder="10-digit number"
                inputMode="numeric"
                value={gatePhone}
                onChange={(e) => { setGatePhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setGateError("") }}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            {gateError && <p className="text-xs text-red-500">{gateError}</p>}
            <button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl py-3.5 text-sm transition-colors"
            >
              View Menu &amp; Order
            </button>
            <p className="text-xs text-gray-400 text-center">
              We use this to track your order and loyalty points
            </p>
          </form>
        </div>
      </div>
    )
  }

  if (!orderingEnabled) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">😴</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">We're closed right now</h2>
          <p className="text-gray-500 text-sm">Online ordering is temporarily unavailable.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          {info.logoUrl && (
            <img src={info.logoUrl} alt={info.name} className="w-8 h-8 rounded-full object-cover" />
          )}
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">{info.name}</h1>
            {customerName && <p className="text-xs text-gray-400">Hi, {customerName.split(" ")[0]}!</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Account icon — shows dropdown with logout */}
          <div className="relative">
            <button
              onClick={() => setAccountMenuOpen((o) => !o)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              aria-label="Account"
            >
              <User className="w-4 h-4 text-gray-600" />
            </button>
            {accountMenuOpen && (
              <>
                {/* backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAccountMenuOpen(false)}
                />
                <div className="absolute right-0 top-11 z-50 bg-white rounded-xl shadow-lg border border-gray-100 min-w-[160px] overflow-hidden">
                  <button
                    onClick={() => { setAccountMenuOpen(false); router.push(`/account/${info.id}`) }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User className="w-4 h-4 text-gray-500" />
                    My Account
                  </button>
                  {isLoggedIn() && (
                    <button
                      onClick={() => {
                        setAccountMenuOpen(false)
                        clearAuth()
                        sessionStorage.removeItem("pk-identity")
                        setGated(true)
                        toast.success("Logged out")
                      }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-gray-100"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative bg-orange-500 text-white rounded-full p-2"
            aria-label="Open cart"
          >
          <ShoppingCart className="w-5 h-5" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {cartCount}
            </span>
          )}
          </button>
        </div>
      </div>

      {/* Order type selector */}
      {(canDeliver || canTakeaway) && (
        <div className="bg-white border-b border-gray-100 px-4 py-2 flex gap-2">
          {canTakeaway && (
            <button
              onClick={() => setOrderType("TAKEAWAY")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                orderType === "TAKEAWAY" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Takeaway
            </button>
          )}
          {canDeliver && (
            <button
              onClick={() => setOrderType("DELIVERY")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                orderType === "DELIVERY" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              <Truck className="w-3.5 h-3.5" /> Delivery
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Search menu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveCat(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!activeCat ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCat === c.id ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {c.name}
          </button>
        ))}
        <button
          onClick={() => setVegOnly((v) => !v)}
          className={`shrink-0 ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${vegOnly ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"}`}
          aria-pressed={vegOnly}
        >
          <Leaf className="w-3.5 h-3.5" /> Veg
        </button>
      </div>

      {/* Menu items */}
      {menuLoading ? (
        <div className="flex items-center justify-center py-20"><div className="text-3xl animate-bounce">🐼</div></div>
      ) : (
        <div className="p-4 grid grid-cols-2 gap-3 pb-32">
          {filtered.map((item) => {
            const inCartItems = cartItems.filter((i) => i.menuItemId === item.id)
            const totalQty = inCartItems.reduce((s, i) => s + i.quantity, 0)
            const hasOptions = (item.variants?.length ?? 0) > 0 || (item.addonGroups?.length ?? 0) > 0
            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-28 bg-orange-50 flex items-center justify-center text-3xl">🍽️</div>
                )}
                <div className="p-2.5">
                  <div className="flex items-start gap-1 mb-1">
                    <span className={`mt-1 shrink-0 w-2.5 h-2.5 rounded-sm border-2 ${item.isVeg ? "border-green-600 bg-green-600" : "border-red-500 bg-red-500"}`} />
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{item.name}</p>
                  </div>
                  <p className="text-sm font-bold text-orange-600 mb-2">₹{item.price.toFixed(2)}</p>
                  {item.allergens && item.allergens.length > 0 && (
                    <p className="text-xs text-red-600 bg-red-50 rounded px-1.5 py-0.5 mb-2">Contains: {item.allergens.join(", ")}</p>
                  )}
                  {hasOptions ? (
                    <button
                      onClick={() => handleItemClick(item)}
                      className="w-full bg-orange-500 text-white rounded-lg py-1.5 text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Customise
                    </button>
                  ) : totalQty > 0 ? (
                    <div className="flex items-center justify-between">
                      <button onClick={() => updateQty(inCartItems[0].cartKey, -1)} className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center" aria-label="Decrease">
                        <Minus className="w-3 h-3 text-orange-600" />
                      </button>
                      <span className="text-sm font-semibold">{totalQty}</span>
                      <button onClick={() => handleItemClick(item)} className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center" aria-label="Increase">
                        <Plus className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleItemClick(item)}
                      className="w-full bg-orange-500 text-white rounded-lg py-1.5 text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-2 text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">🔍</p><p>No items found</p>
            </div>
          )}
        </div>
      )}

      {/* Floating cart button */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-6 left-4 right-4 z-40">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-orange-500 text-white rounded-xl py-3 px-4 flex items-center justify-between shadow-lg"
          >
            <span className="bg-orange-600 rounded-lg px-2 py-0.5 text-sm font-semibold">{cartCount}</span>
            <span className="font-semibold">View Cart</span>
            <span className="font-bold">₹{total().toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Item detail sheet */}
      {selectedItem && (
        <ItemDetailSheet
          item={selectedItem as MenuItemDetail}
          onClose={() => setSelectedItem(null)}
          onAddToCart={handleAddFromSheet}
        />
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setCartOpen(false)}>
          <div className="bg-white rounded-t-2xl w-full p-5 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Your Order</h3>
              <button onClick={() => setCartOpen(false)} aria-label="Close cart"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3 mb-4">
              {cartItems.length === 0 && <p className="text-center text-gray-400 py-6">Cart is empty</p>}
              {cartItems.map((item) => (
                <div key={item.cartKey} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-3">
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      {item.variantName && <p className="text-xs text-gray-400">{item.variantName}</p>}
                      {item.addons && item.addons.length > 0 && (
                        <p className="text-xs text-gray-400">{item.addons.map(a => a.name).join(", ")}</p>
                      )}
                      {item.notes && <p className="text-xs text-gray-400 italic">{item.notes}</p>}
                      <p className="text-sm text-orange-600 font-semibold">₹{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.cartKey, -1)} className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center" aria-label="Decrease"><Minus className="w-3 h-3" /></button>
                      <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => {
                          const menuItem = items.find(i => i.id === item.menuItemId)
                          if (menuItem && ((menuItem.variants?.length ?? 0) > 0 || (menuItem.addonGroups?.length ?? 0) > 0)) {
                            setSelectedItem(menuItem)
                          } else {
                            updateQty(item.cartKey, 1)
                          }
                        }}
                        className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center" aria-label="Increase"
                      ><Plus className="w-3 h-3 text-white" /></button>
                    </div>
                  </div>
                  {expandedNoteItemKey === item.cartKey ? (
                    <input
                      autoFocus type="text" placeholder="Add a note…"
                      value={item.notes ?? ""}
                      onChange={e => updateNote(item.cartKey, e.target.value)}
                      onBlur={() => setExpandedNoteItemKey(null)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  ) : (
                    <button onClick={() => setExpandedNoteItemKey(item.cartKey)} className="text-xs text-gray-400 hover:text-orange-500 text-left">
                      {item.notes ? "Edit note" : "+ Add note"}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4">
              <div className="flex justify-between mb-4">
                <span className="font-semibold text-gray-700">Total</span>
                <span className="font-bold text-lg text-gray-900">₹{total().toFixed(2)}</span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={cartItems.length === 0}
                className="w-full bg-orange-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
