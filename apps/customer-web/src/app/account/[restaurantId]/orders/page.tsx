"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, ShoppingBag } from "lucide-react"

interface OrderSummary {
  id: string
  orderNumber: string
  status: string
  total: number
  orderType?: string
  createdAt?: string
  items: Array<{ name?: string; menuItem?: { name: string }; quantity: number }>
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-orange-100 text-orange-700",
  READY:     "bg-green-100 text-green-700",
  SERVED:    "bg-green-100 text-green-700",
  PAID:      "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  DINE_IN:  "Dine In",
  TAKEAWAY: "Takeaway",
  DELIVERY: "Delivery",
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"

function getStoredOrderIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem("pk-my-orders")
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function formatDate(iso: string | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
}

function itemsSummary(items: OrderSummary["items"]): string {
  return items
    .slice(0, 3)
    .map((i) => {
      const n = i.name ?? i.menuItem?.name ?? "Item"
      return i.quantity > 1 ? `${i.quantity}× ${n}` : n
    })
    .join(", ") + (items.length > 3 ? ` +${items.length - 3} more` : "")
}

export default function OrderHistoryPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>()
  const router = useRouter()

  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const ids = getStoredOrderIds()
      if (ids.length === 0) { setLoading(false); return }

      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`${API_BASE}/orders/${id}/track`)
            .then((r) => r.ok ? r.json() as Promise<OrderSummary> : Promise.reject())
        )
      )

      const loaded: OrderSummary[] = results
        .filter((r): r is PromiseFulfilledResult<OrderSummary> => r.status === "fulfilled")
        .map((r) => r.value)

      // Newest first (preserve localStorage order which is already newest-first)
      setOrders(loaded)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">My Orders</h1>
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🐼</div>
            <p className="text-gray-400 text-sm">Loading your orders…</p>
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="text-center py-16">
            <ShoppingBag className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-semibold">No orders yet</p>
            <p className="text-gray-400 text-sm mt-1">Your orders will appear here after checkout.</p>
            <button
              onClick={() => router.push(`/menu/${restaurantId}`)}
              className="mt-5 bg-orange-500 text-white rounded-xl px-6 py-2.5 text-sm font-semibold"
            >
              Browse Menu
            </button>
          </div>
        )}

        {orders.map((order) => (
          <button
            key={order.id}
            onClick={() => router.push(`/order/${order.id}`)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:border-orange-200 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-sm font-bold text-gray-900">{order.orderNumber}</p>
                {order.createdAt && (
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.createdAt)}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {order.status}
                </span>
                {order.orderType && (
                  <span className="text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">
                    {ORDER_TYPE_LABELS[order.orderType] ?? order.orderType}
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-gray-500 line-clamp-1 mb-2">
              {itemsSummary(order.items)}
            </p>

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-orange-600">₹{Number(order.total).toFixed(2)}</span>
              <span className="text-xs text-orange-500 font-medium">View details →</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
