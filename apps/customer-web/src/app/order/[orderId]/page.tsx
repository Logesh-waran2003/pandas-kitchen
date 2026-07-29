"use client"
import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle, Clock, ChefHat, Bell, Utensils, HelpCircle, PartyPopper, XCircle, BellRing, Receipt, RefreshCw, RotateCcw } from "lucide-react"
import { connectSocket, disconnectSocket } from "@/lib/socket"
import { useCartStore } from "@/stores/cart.store"

type OrderStatus = "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "SERVED" | "PAID" | "CANCELLED"

interface OrderItem {
  id: string
  name?: string
  menuItem?: { id: string; name: string }
  quantity: number
  unitPrice: number
  totalPrice: number
  variantName?: string | null
}

interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  total: number
  subtotal?: number
  tax?: number
  orderType?: "DINE_IN" | "TAKEAWAY" | "DELIVERY"
  pickupCode?: string | null
  items: OrderItem[]
  table?: { tableNumber: string } | null
  createdAt?: string
  paymentLabel?: string
}

const STATUS_STEPS: { key: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { key: "PENDING",    label: "Order Placed",   icon: <Clock className="w-4 h-4" /> },
  { key: "CONFIRMED",  label: "Confirmed",       icon: <CheckCircle className="w-4 h-4" /> },
  { key: "PREPARING",  label: "Preparing",       icon: <ChefHat className="w-4 h-4" /> },
  { key: "READY",      label: "Ready",           icon: <Bell className="w-4 h-4" /> },
  { key: "SERVED",     label: "Served",          icon: <Utensils className="w-4 h-4" /> },
]

const STATUS_ORDER: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY", "SERVED"]

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"

function getStatusIndex(status: OrderStatus): number {
  return STATUS_ORDER.indexOf(status)
}

function StatusMessage({ status }: { status: OrderStatus }) {
  const msgs: Record<OrderStatus, string> = {
    PENDING:   "Your order has been received. Waiting for confirmation…",
    CONFIRMED: "Great! The kitchen has confirmed your order.",
    PREPARING: "Your food is being prepared. Sit tight! 🍳",
    READY:     "Your order is ready! A waiter will bring it to you shortly.",
    SERVED:    "Enjoy your meal! 😊",
    PAID:      "Payment received. Thank you! 🙏",
    CANCELLED: "Your order was cancelled.",
  }
  return <p className="text-sm text-gray-500 text-center mt-2">{msgs[status]}</p>
}

function getCustomerToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("pk-customer-auth")
    return raw ? JSON.parse(raw)?.token ?? null : null
  } catch { return null }
}

function getCustomerId(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("pk-customer-auth")
    return raw ? JSON.parse(raw)?.customerId ?? null : null
  } catch { return null }
}

function getCancelSecondsLeft(createdAt: string | undefined): number {
  if (!createdAt) return 0
  const elapsed = Date.now() - new Date(createdAt).getTime()
  return Math.max(0, Math.floor((2 * 60 * 1000 - elapsed) / 1000))
}

export default function OrderTrackerPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [cancelSecondsLeft, setCancelSecondsLeft] = useState(0)
  const [cancelling, setCancelling] = useState(false)
  const [waiterSent, setWaiterSent] = useState(false)
  const [billSent, setBillSent] = useState(false)
  const [selectedRating, setSelectedRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [submittingRating, setSubmittingRating] = useState(false)
  const [rated, setRated] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const cancelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null)
  const readyNotifiedRef = useRef(false)

  const tableId = useCartStore((s) => s.tableId)
  const branchId = useCartStore((s) => s.branchId)
  const restaurantId = useCartStore((s) => s.restaurantId)
  const addItem = useCartStore((s) => s.addItem)
  const cartItems = useCartStore((s) => s.items)

  // ── Request notification permission on mount ─────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => { /* non-fatal */ })
      }
    }
  }, [])

  // ── Load order from localStorage ─────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem("pk-last-order")
      if (raw) {
        const stored = JSON.parse(raw) as Order
        if (stored.id === orderId) {
          setOrder(stored)
          if (stored.status === "PENDING") {
            setCancelSecondsLeft(getCancelSecondsLeft(stored.createdAt))
          }
        }
      }
    } catch { /* ignore */ }
  }, [orderId])

  // ── Cancel countdown timer ────────────────────────────────────────────────
  useEffect(() => {
    if (cancelSecondsLeft <= 0) return
    cancelTimerRef.current = setInterval(() => {
      setCancelSecondsLeft((prev) => {
        if (prev <= 1) { clearInterval(cancelTimerRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => { if (cancelTimerRef.current) clearInterval(cancelTimerRef.current) }
  }, [cancelSecondsLeft > 0]) // only re-run when crossing 0

  // ── Socket: live updates ─────────────────────────────────────────────────
  useEffect(() => {
    const token = getCustomerToken()
    if (!token) return

    const socket = connectSocket(token)
    socketRef.current = socket

    socket.on("connect", () => { socket.emit("join:order", orderId) })

    socket.on("order.status_changed", (data: { id: string; status: OrderStatus }) => {
      if (data.id !== orderId) return
      setOrder((prev) => prev ? { ...prev, status: data.status } : prev)
      if (data.status === "CANCELLED") setCancelled(true)
      if (data.status !== "PENDING") {
        setCancelSecondsLeft(0)
        if (cancelTimerRef.current) clearInterval(cancelTimerRef.current)
      }
      if (data.status === "READY" && !readyNotifiedRef.current) {
        readyNotifiedRef.current = true
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification("Your order is ready! 🎉", {
            body: "Come pick it up at the counter.",
            icon: "/favicon.ico",
          })
        }
      }
    })

    socket.on("payment.completed", (data: { orderId: string }) => {
      if (data.orderId !== orderId) return
      setPaymentConfirmed(true)
    })

    socket.on("order.cancelled", (data: { id: string }) => {
      if (data.id !== orderId) return
      setCancelled(true)
      setOrder((prev) => prev ? { ...prev, status: "CANCELLED" } : prev)
    })

    return () => {
      socket.off("connect")
      socket.off("order.status_changed")
      socket.off("payment.completed")
      socket.off("order.cancelled")
      disconnectSocket()
      socketRef.current = null
    }
  }, [orderId])

  // ── Manual refresh ────────────────────────────────────────────────────────
  async function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      const token = getCustomerToken()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`
      const res = await fetch(`${API_BASE}/orders/${orderId}`, { headers })
      if (!res.ok) throw new Error("Failed to fetch order")
      const data = await res.json() as Order
      setOrder((prev) => ({ ...(prev ?? {}), ...data }))
      if (data.status === "CANCELLED") setCancelled(true)
    } catch {
      toast.error("Could not refresh order")
    } finally {
      setRefreshing(false)
    }
  }

  // ── Reorder ───────────────────────────────────────────────────────────────
  function handleReorder() {
    if (!order || !restaurantId) return
    order.items.forEach((item) => {
      const name = item.name ?? item.menuItem?.name ?? "Item"
      addItem({
        menuItemId: item.menuItem?.id ?? item.id,
        name,
        price: Number(item.unitPrice),
        quantity: item.quantity,
        variantName: item.variantName ?? undefined,
      })
    })
    router.push("/checkout")
  }

  // ── Call waiter / request bill ────────────────────────────────────────────
  function handleCallWaiter() {
    if (!tableId || !branchId || !socketRef.current) return
    socketRef.current.emit("table:call-waiter", {
      tableId,
      tableNumber: order?.table?.tableNumber ?? tableId,
      branchId,
    })
    setWaiterSent(true)
    setTimeout(() => setWaiterSent(false), 2000)
  }

  function handleRequestBill() {
    if (!tableId || !branchId || !socketRef.current) return
    socketRef.current.emit("table:request-bill", {
      tableId,
      tableNumber: order?.table?.tableNumber ?? tableId,
      branchId,
    })
    setBillSent(true)
    setTimeout(() => setBillSent(false), 2000)
  }

  async function handleSubmitRating() {
    const customerId = getCustomerId()
    if (!customerId || !selectedRating) return
    setSubmittingRating(true)
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/rating`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: selectedRating, customerId }),
      })
      if (!res.ok) throw new Error("Failed to submit rating")
      setRated(true)
      toast.success("Rating submitted!")
    } catch {
      toast.error("Could not submit rating")
    } finally {
      setSubmittingRating(false)
    }
  }

  // ── Cancel handler ────────────────────────────────────────────────────────
  async function handleCancel() {
    if (cancelling) return
    const customerId = getCustomerId()
    if (!customerId) { toast.error("Login required to cancel"); return }
    setCancelling(true)
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to cancel" }))
        throw new Error(err.message)
      }
      setCancelled(true)
      setOrder((prev) => prev ? { ...prev, status: "CANCELLED" } : prev)
      toast.success("Order cancelled")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel order")
    } finally {
      setCancelling(false)
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!order) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🐼</div>
          <p className="text-gray-500 text-sm">Loading your order…</p>
        </div>
      </div>
    )
  }

  if (paymentConfirmed) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-6">
        <div className="text-center">
          <PartyPopper className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Payment Confirmed!</h2>
          <p className="text-gray-500 mb-1">Thank you for dining with us.</p>
          <p className="text-sm text-gray-400">Order {order.orderNumber}</p>
        </div>
      </div>
    )
  }

  if (cancelled || order.status === "CANCELLED") {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-6">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Order Cancelled</h2>
          <p className="text-gray-500 text-sm">Order {order.orderNumber} was cancelled.</p>
          <p className="text-gray-400 text-sm mt-1">Please speak to your waiter for assistance.</p>
        </div>
      </div>
    )
  }

  const currentIdx = getStatusIndex(order.status)

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-orange-500 px-4 py-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80 mb-0.5">Order Tracker</p>
            <h1 className="text-2xl font-extrabold">{order.orderNumber}</h1>
            {order.table && (
              <p className="text-sm opacity-80 mt-0.5">Table {order.table.tableNumber}</p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh order status"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-white ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* READY banner */}
        {order.status === "READY" && (
          <div className="bg-green-500 rounded-2xl p-4 text-white text-center shadow-sm">
            <p className="text-xl font-extrabold mb-0.5">Your order is ready! 🎉</p>
            {order.orderType === "TAKEAWAY" && order.pickupCode && (
              <p className="text-sm opacity-90">Show your pickup code at the counter</p>
            )}
          </div>
        )}

        {/* 2-minute cancel window */}
        {order.status === "PENDING" && cancelSecondsLeft > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Changed your mind?</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Can cancel for{" "}
                <span className="font-semibold text-orange-500">{cancelSecondsLeft}s</span>
              </p>
            </div>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
            >
              {cancelling ? "Cancelling…" : "Cancel Order"}
            </button>
          </div>
        )}

        {/* Status stepper */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Order Status
          </h2>

          <div className="space-y-0">
            {STATUS_STEPS.map((step, idx) => {
              const isDone    = idx < currentIdx
              const isCurrent = idx === currentIdx
              const isLast    = idx === STATUS_STEPS.length - 1

              return (
                <div key={step.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isDone
                          ? "bg-orange-500 text-white"
                          : isCurrent
                          ? "bg-orange-500 text-white ring-4 ring-orange-100"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {isDone ? <CheckCircle className="w-4 h-4" /> : step.icon}
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 h-8 mt-0.5 ${isDone ? "bg-orange-500" : "bg-gray-200"}`} />
                    )}
                  </div>

                  <div className="pt-1.5 pb-6">
                    <p
                      className={`text-sm font-semibold ${
                        isCurrent ? "text-orange-600" : isDone ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && (
                      <span className="text-xs bg-orange-100 text-orange-600 rounded-full px-2 py-0.5 mt-0.5 inline-block font-medium">
                        In progress
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <StatusMessage status={order.status} />

          {/* Estimated time */}
          {(order.status === "PENDING" || order.status === "CONFIRMED") && (
            <p className="text-xs text-center text-orange-500 font-medium mt-2">
              ⏱ Estimated ready in ~20 mins
            </p>
          )}
          {order.status === "PREPARING" && (
            <p className="text-xs text-center text-orange-500 font-medium mt-2">
              🍳 Almost ready! ~10 mins
            </p>
          )}
          {order.status === "READY" && (
            <p className="text-xs text-center text-green-600 font-semibold mt-2">
              ✅ Ready now!
            </p>
          )}
        </div>

        {/* Pickup code card — shown for TAKEAWAY when order is READY or PAID */}
        {order.orderType === "TAKEAWAY" && order.pickupCode &&
          (order.status === "READY" || order.status === "PAID") && (
          <div className="bg-orange-50 border-2 border-orange-400 rounded-2xl p-5 text-center shadow-sm">
            <p className="text-sm font-semibold text-orange-700 mb-2 uppercase tracking-wide">
              Your Pickup Code
            </p>
            <p className="text-5xl font-black text-orange-600 tracking-widest mb-3">
              {order.pickupCode}
            </p>
            <p className="text-sm text-orange-700">
              Show this code at the counter to collect your order
            </p>
          </div>
        )}

        {/* Items */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Your Items
          </h2>
          <div className="space-y-3">
            {order.items.map((item, i) => {
              const name = item.name ?? item.menuItem?.name ?? "Item"
              const linePrice = Number(item.totalPrice ?? 0)
              return (
                <div key={item.id ?? i} className="flex items-start justify-between">
                  <div className="flex-1 mr-3">
                    <p className="text-sm font-medium text-gray-900">{name}</p>
                    {item.variantName && (
                      <p className="text-xs text-gray-400">{item.variantName}</p>
                    )}
                    <p className="text-xs text-gray-400">× {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">₹{linePrice.toFixed(2)}</p>
                </div>
              )
            })}
          </div>

          <div className="border-t border-gray-100 mt-4 pt-4 space-y-1.5">
            {order.subtotal !== undefined && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>₹{Number(order.subtotal).toFixed(2)}</span>
              </div>
            )}
            {order.tax !== undefined && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax &amp; charges</span>
                <span>₹{Number(order.tax).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-1">
              <span>Total</span>
              <span>₹{Number(order.total).toFixed(2)}</span>
            </div>
            {order.paymentLabel && (
              <div className="flex justify-between text-sm text-gray-500 pt-1 border-t border-gray-100 mt-1">
                <span>Payment</span>
                <span>{order.paymentLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* Reorder — shown for PAID orders */}
        {order.status === "PAID" && restaurantId && (
          <button
            onClick={handleReorder}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-3.5 font-semibold text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reorder
          </button>
        )}

        {/* Receipt link for served/paid orders */}
        {(order.status === "SERVED" || order.status === "PAID") && (
          <a
            href={`${process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000"}/orders/${orderId}/receipt`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 border-2 border-orange-200 text-orange-600 rounded-2xl py-3.5 font-semibold text-sm bg-white"
          >
            🧾 View Receipt
          </a>
        )}

        {/* Call Waiter + Request Bill */}
        {tableId && branchId && (
          <div className="flex gap-3">
            <button
              onClick={handleCallWaiter}
              className="flex-1 flex items-center justify-center gap-2 border-2 border-orange-200 text-orange-600 rounded-2xl py-3.5 font-semibold text-sm bg-white active:bg-orange-50 transition-colors"
              aria-label="Call waiter"
            >
              <BellRing className="w-4 h-4" />
              {waiterSent ? "Sent!" : "Call Waiter"}
            </button>
            <button
              onClick={handleRequestBill}
              className="flex-1 flex items-center justify-center gap-2 border-2 border-orange-200 text-orange-600 rounded-2xl py-3.5 font-semibold text-sm bg-white active:bg-orange-50 transition-colors"
              aria-label="Request bill"
            >
              <Receipt className="w-4 h-4" />
              {billSent ? "Sent!" : "Request Bill"}
            </button>
          </div>
        )}

        {/* Star rating card */}
        {(order.status === "SERVED" || order.status === "PAID") && !rated && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 text-center">How was your meal?</h2>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setSelectedRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className={`text-3xl transition-transform hover:scale-110 ${
                    star <= (hoverRating || selectedRating) ? "text-orange-400" : "text-gray-200"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            {selectedRating > 0 && (
              <button
                onClick={handleSubmitRating}
                disabled={submittingRating}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-3 font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {submittingRating ? "Submitting…" : "Submit Rating"}
              </button>
            )}
          </div>
        )}
        {rated && (order.status === "SERVED" || order.status === "PAID") && (
          <div className="bg-orange-50 rounded-2xl p-4 text-center border border-orange-100">
            <p className="text-orange-600 font-semibold text-sm">Thanks for your feedback! ⭐</p>
          </div>
        )}

        {/* Help */}
        <button
          onClick={() => toast.info("Please call your waiter for assistance.")}
          className="w-full flex items-center justify-center gap-2 border-2 border-orange-200 text-orange-600 rounded-2xl py-3.5 font-semibold text-sm bg-white"
          aria-label="Need help"
        >
          <HelpCircle className="w-4 h-4" />
          Need Help?
        </button>
      </div>
    </div>
  )
}
