"use client"
import { useEffect, useState, useRef } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { useCartStore } from "@/stores/cart.store"
import { toast } from "sonner"
import { ShoppingCart, Plus, Minus, Search, X, Leaf, Phone, User, MessageSquare, Send } from "lucide-react"
import { connectSocket, disconnectSocket } from "@/lib/socket"

interface Category {
  id: string
  name: string
}

interface Variant {
  id: string
  name: string
  price: number
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
}

interface CustomerAuth {
  token: string
  customerId: string
  firstName: string
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

function getCustomerAuth(): CustomerAuth | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("pk-customer-auth")
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function setCustomerAuth(auth: CustomerAuth) {
  localStorage.setItem("pk-customer-auth", JSON.stringify(auth))
}

export default function MenuPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const tableId = searchParams.get("tableId")
  const branchId = searchParams.get("branchId")

  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [search, setSearch] = useState("")
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [vegOnly, setVegOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [variantItem, setVariantItem] = useState<MenuItem | null>(null)
  const [variants, setVariants] = useState<Variant[]>([])
  const [cartOpen, setCartOpen] = useState(false)

  // Login modal state
  const [showLogin, setShowLogin] = useState(false)
  const [loginFirstName, setLoginFirstName] = useState("")
  const [loginPhone, setLoginPhone] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)

  // Order placing state
  const [placing, setPlacing] = useState(false)
  const [orderType, setOrderType] = useState<"DINE_IN" | "DELIVERY">("DINE_IN")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [paxCount, setPaxCount] = useState(1)
  const [expandedNoteItemKey, setExpandedNoteItemKey] = useState<string | null>(null)

  // AI chat state
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const { items: cartItems, addItem, updateQty, updateNote, clearCart, total } = useCartStore()
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0)

  // ── Load menu data ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<{
          restaurant: { id: string; name: string; currency: string }
          categories: Array<{ id: string; name: string; items: MenuItem[] }>
        }>(`/menu/public/${restaurantId}`)
        const cats = data.categories.map((c) => ({ id: c.id, name: c.name }))
        const allItems = data.categories.flatMap((c) =>
          c.items.map((i) => ({ ...i, categoryId: c.id }))
        )
        setCategories(cats)
        setItems(allItems)
      } catch {
        toast.error("Failed to load menu")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [restaurantId])

  // ── Socket: join table room, listen for table closure ─────────────────────
  useEffect(() => {
    if (!tableId) return

    const auth = getCustomerAuth()
    // Socket gateway requires a JWT — only connect if customer is logged in
    if (!auth?.token) return

    const socket = connectSocket(auth.token)

    socket.on("connect", () => {
      socket.emit("join:branch", branchId)
    })

    socket.on("table.status_changed", (data: { tableId: string; status: string }) => {
      if (data.tableId === tableId && data.status === "CLOSED") {
        toast.info("This table has been closed. Thank you!")
      }
    })

    return () => {
      socket.off("table.status_changed")
      socket.off("connect")
      disconnectSocket()
    }
  }, [tableId, branchId])

  // ── Item helpers ───────────────────────────────────────────────────────────
  const filtered = items.filter((i) => {
    const matchCat = !activeCat || i.categoryId === activeCat
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase())
    const matchVeg = !vegOnly || i.isVeg === true
    return matchCat && matchSearch && matchVeg && i.isAvailable
  })

  async function handleAddItem(item: MenuItem) {
    try {
      const vars = await apiFetch<Variant[]>(`/menu/public/items/${item.id}/variants`)
      if (vars.length > 0) {
        setVariants(vars)
        setVariantItem(item)
        return
      }
    } catch {
      // no variants endpoint or empty — fall through
    }
    addItem({ menuItemId: item.id, name: item.name, price: item.price, quantity: 1 })
    toast.success(`${item.name} added`)
  }

  function handleVariantSelect(item: MenuItem, variant: Variant) {
    addItem({
      menuItemId: item.id,
      name: item.name,
      price: variant.price,
      quantity: 1,
      variantId: variant.id,
      variantName: variant.name,
    })
    toast.success(`${item.name} (${variant.name}) added`)
    setVariantItem(null)
  }

  // ── Order placement ────────────────────────────────────────────────────────
  function handlePlaceOrderClick() {
    if (!branchId) { toast.error("Table info missing"); return }
    if (cartItems.length === 0) { toast.error("Cart is empty"); return }
    if (orderType === "DELIVERY" && !deliveryAddress.trim()) {
      toast.error("Please enter a delivery address"); return
    }
    const auth = getCustomerAuth()
    if (!auth) {
      setShowLogin(true)
      return
    }
    submitOrder(auth.customerId)
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loginPhone.length < 10) { toast.error("Enter a valid 10-digit phone number"); return }
    if (!loginFirstName.trim()) { toast.error("Please enter your name"); return }

    setLoginLoading(true)
    try {
      const res = await apiFetch<{ token: string; customerId: string }>("/auth/customer/login", {
        method: "POST",
        body: JSON.stringify({ restaurantId, phone: loginPhone, firstName: loginFirstName.trim() }),
      })
      const auth: CustomerAuth = { token: res.token, customerId: res.customerId, firstName: loginFirstName.trim() }
      setCustomerAuth(auth)
      setShowLogin(false)
      submitOrder(auth.customerId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed. Please try again.")
    } finally {
      setLoginLoading(false)
    }
  }

  async function submitOrder(customerId?: string) {
    if (!branchId) return
    setPlacing(true)
    setCartOpen(false)
    try {
      const order = await apiFetch<{ id: string; orderNumber: string; status: string; total: number; items: unknown[] }>(
        "/orders/public",
        {
          method: "POST",
          body: JSON.stringify({
            branchId,
            tableId: tableId ?? undefined,
            orderType,
            deliveryAddress: orderType === "DELIVERY" ? deliveryAddress.trim() : undefined,
            customerId: customerId ?? undefined,
            paxCount,
            items: cartItems.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              variantId: i.variantId ?? undefined,
              notes: i.notes,
            })),
          }),
        }
      )
      // Store full order for tracker page (no customer-facing GET endpoint yet)
      if (typeof window !== "undefined") {
        localStorage.setItem("pk-last-order", JSON.stringify(order))
      }
      clearCart()
      toast.success(`Order ${order.orderNumber} placed! 🎉`)
      router.push(`/order/${order.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to place order")
    } finally {
      setPlacing(false)
    }
  }

  async function sendChatMessage(e: React.FormEvent) {
    e.preventDefault()
    const text = chatInput.trim()
    if (!text || chatLoading) return

    const userMsg: ChatMessage = { role: "user", content: text }
    setChatMessages((prev) => [...prev, userMsg])
    setChatInput("")
    setChatLoading(true)

    const auth = getCustomerAuth()

    try {
      if (!auth) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Please login to chat with our AI assistant." },
        ])
        return
      }

      const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          restaurantId,
          messages: [...chatMessages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) throw new Error("Chat failed")
      const data = await res.json()
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.message }])
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't connect right now. Please try again!" },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🐼</div>
          <p className="text-gray-500">Loading menu…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-gray-900">🐼 Pandas Kitchen</h1>
          {tableId && <p className="text-xs text-gray-500">Table {tableId}</p>}
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

      {/* Category tabs + veg filter */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveCat(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !activeCat ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCat === c.id ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {c.name}
          </button>
        ))}
        <button
          onClick={() => setVegOnly((v) => !v)}
          className={`shrink-0 ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            vegOnly ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"
          }`}
          aria-pressed={vegOnly}
          aria-label="Veg only filter"
        >
          <Leaf className="w-3.5 h-3.5" />
          Veg
        </button>
      </div>

      {/* Menu items grid */}
      <div className="p-4 grid grid-cols-2 gap-3 pb-32">
        {filtered.map((item) => {
          const inCart = cartItems.find((i) => i.menuItemId === item.id && !i.variantId)
          return (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
            >
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-full h-28 object-cover" />
              ) : (
                <div className="w-full h-28 bg-orange-50 flex items-center justify-center text-3xl">
                  🍽️
                </div>
              )}
              <div className="p-2.5">
                <div className="flex items-start gap-1 mb-1">
                  <span
                    className={`mt-1 shrink-0 w-2.5 h-2.5 rounded-sm border-2 ${
                      item.isVeg ? "border-green-600 bg-green-600" : "border-red-500 bg-red-500"
                    }`}
                    aria-label={item.isVeg ? "Vegetarian" : "Non-vegetarian"}
                  />
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{item.name}</p>
                </div>
                <p className="text-sm font-bold text-orange-600 mb-2">₹{item.price.toFixed(2)}</p>
                {item.allergens && item.allergens.length > 0 && (
                  <p className="text-xs text-red-600 bg-red-50 rounded px-1.5 py-0.5 mb-2 leading-snug">
                    Contains: {item.allergens.join(", ")}
                  </p>
                )}
                {inCart ? (
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => updateQty(item.id, undefined, -1)}
                      className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3 h-3 text-orange-600" />
                    </button>
                    <span className="text-sm font-semibold">{inCart.quantity}</span>
                    <button
                      onClick={() => updateQty(item.id, undefined, 1)}
                      className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAddItem(item)}
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
            <p className="text-3xl mb-2">🔍</p>
            <p>No items found</p>
          </div>
        )}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-6 left-4 right-4 z-40">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-orange-500 text-white rounded-xl py-3 px-4 flex items-center justify-between shadow-lg"
          >
            <span className="bg-orange-600 rounded-lg px-2 py-0.5 text-sm font-semibold">
              {cartCount}
            </span>
            <span className="font-semibold">View Cart</span>
            <span className="font-bold">₹{total().toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Variant modal */}
      {variantItem && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4"
          onClick={() => setVariantItem(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{variantItem.name}</h3>
              <button onClick={() => setVariantItem(null)} aria-label="Close">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-3">Select a variant:</p>
            {variants.map((v) => (
              <button
                key={v.id}
                onClick={() => handleVariantSelect(variantItem, v)}
                className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl mb-2 hover:border-orange-400 hover:bg-orange-50 transition-colors"
              >
                <span className="font-medium text-gray-900">{v.name}</span>
                <span className="text-orange-600 font-bold">₹{v.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full p-5 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Your Order</h3>
              <button onClick={() => setCartOpen(false)} aria-label="Close cart">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Order type selector */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setOrderType("DINE_IN")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  orderType === "DINE_IN"
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                🪑 Dine In
              </button>
              <button
                onClick={() => setOrderType("DELIVERY")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  orderType === "DELIVERY"
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                🚚 Delivery
              </button>
            </div>

            {/* Party size */}
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm text-gray-600 font-medium">Party size</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaxCount(n => Math.max(1, n - 1))}
                  className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center"
                  aria-label="Decrease party size"
                >
                  <Minus className="w-3 h-3 text-gray-600" />
                </button>
                <span className="text-sm font-semibold w-5 text-center">{paxCount}</span>
                <button
                  onClick={() => setPaxCount(n => Math.min(20, n + 1))}
                  className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center"
                  aria-label="Increase party size"
                >
                  <Plus className="w-3 h-3 text-white" />
                </button>
              </div>
            </div>

            {/* Dine-in table info */}
            {orderType === "DINE_IN" && tableId && (
              <p className="text-xs text-gray-500 mb-3 text-center">
                Ordering for <span className="font-semibold text-gray-700">Table {tableId}</span>
              </p>
            )}

            {/* Delivery address */}
            {orderType === "DELIVERY" && (
              <textarea
                rows={2}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter your delivery address…"
                className="w-full mb-3 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            )}
            <div className="overflow-y-auto flex-1 space-y-3 mb-4">
              {cartItems.length === 0 && (
                <p className="text-center text-gray-400 py-6">Cart is empty</p>
              )}
              {cartItems.map((item, i) => {
                const itemKey = `${item.menuItemId}-${item.variantId ?? ""}-${i}`
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-3">
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        {item.variantName && (
                          <p className="text-xs text-gray-400">{item.variantName}</p>
                        )}
                        {item.notes && expandedNoteItemKey !== itemKey && (
                          <p className="text-xs text-gray-400 italic">{item.notes}</p>
                        )}
                        <p className="text-sm text-orange-600 font-semibold">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(item.menuItemId, item.variantId, -1)}
                          className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center"
                          aria-label="Decrease"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.menuItemId, item.variantId, 1)}
                          className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center"
                          aria-label="Increase"
                        >
                          <Plus className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    </div>
                    {expandedNoteItemKey === itemKey ? (
                      <input
                        autoFocus
                        type="text"
                        placeholder="Add a note for this item…"
                        value={item.notes ?? ""}
                        onChange={e => updateNote(item.menuItemId, item.variantId, e.target.value)}
                        onBlur={() => setExpandedNoteItemKey(null)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                    ) : (
                      <button
                        onClick={() => setExpandedNoteItemKey(itemKey)}
                        className="text-xs text-gray-400 hover:text-orange-500 text-left"
                      >
                        {item.notes ? "Edit note" : "+ Add note"}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="border-t border-gray-100 pt-4">
              <div className="flex justify-between mb-4">
                <span className="font-semibold text-gray-700">Total</span>
                <span className="font-bold text-lg text-gray-900">₹{total().toFixed(2)}</span>
              </div>
              <button
                onClick={handlePlaceOrderClick}
                disabled={cartItems.length === 0 || placing}
                className="w-full bg-orange-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {placing && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Place Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer login modal */}
      {showLogin && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] flex items-end"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-gray-900">Quick Login</h3>
              <button onClick={() => setShowLogin(false)} aria-label="Close login">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-5">We need your name and number to place the order.</p>

            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Your first name"
                  value={loginFirstName}
                  onChange={(e) => setLoginFirstName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="10-digit phone number"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  inputMode="numeric"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-orange-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
              >
                {loginLoading && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Continue &amp; Place Order
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating AI chat button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-4 z-[45] w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          aria-label="Chat with AI assistant"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* AI Chat bottom sheet */}
      {chatOpen && (
        <div className="fixed inset-0 bg-black/50 z-[55] flex items-end" onClick={() => setChatOpen(false)}>
          <div
            className="bg-white rounded-t-2xl w-full flex flex-col"
            style={{ maxHeight: "75vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Menu Assistant</p>
                  <p className="text-xs text-gray-400">Ask me about the menu</p>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)} aria-label="Close chat">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {chatMessages.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-2xl mb-2">🤖</p>
                  <p className="text-sm text-gray-500">Hi! I can help you choose from our menu.</p>
                  <p className="text-xs text-gray-400 mt-1">Ask me for recommendations!</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-orange-500 text-white rounded-br-sm"
                        : "bg-gray-100 text-gray-800 rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendChatMessage} className="border-t border-gray-100 px-4 py-3 flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder={getCustomerAuth() ? "Ask about our menu…" : "Login to chat with AI assistant"}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={!getCustomerAuth()}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading || !getCustomerAuth()}
                className="w-9 h-9 bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
