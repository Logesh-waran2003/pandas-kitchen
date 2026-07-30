"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import {
  Truck, ShoppingBag, Clock, CheckCircle, XCircle,
  ChefHat, Bell, Package, RefreshCw, X, Calendar
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { getSocket } from "@/lib/socket"
import { useAuthStore } from "@/stores/auth.store"

type OrderStatus = "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "SERVED" | "PAID" | "CANCELLED"
type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY"

interface OrderItem {
  id: string
  name?: string
  menuItem?: { id: string; name: string }
  quantity: number
  unitPrice: number
  totalPrice: number
  variantName?: string | null
  notes?: string | null
  addons?: { name: string; price: number }[]
}

interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  orderType: OrderType
  orderSource?: string
  subtotal: number
  tax: number
  serviceCharge: number
  deliveryFee: number
  packagingFee: number
  tip: number
  couponDiscount: number
  total: number
  paymentStatus: string
  deliveryAddress?: string | null
  pickupCode?: string | null
  scheduledFor?: string | null
  notes?: string | null
  createdAt: string
  customer?: { id: string; name: string; phone: string } | null
  branch?: { id: string; name: string } | null
  items: OrderItem[]
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING:   "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-orange-100 text-orange-700",
  READY:     "bg-green-100 text-green-700",
  SERVED:    "bg-teal-100 text-teal-700",
  PAID:      "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-500",
}

const NEXT_STATUSES: Partial<Record<OrderStatus, { status: OrderStatus; label: string; color: string }[]>> = {
  PENDING:   [{ status: "CONFIRMED", label: "Accept", color: "bg-green-500 text-white" }, { status: "CANCELLED", label: "Reject", color: "bg-red-500 text-white" }],
  CONFIRMED: [{ status: "PREPARING", label: "Mark Preparing", color: "bg-orange-500 text-white" }],
  PREPARING: [{ status: "READY", label: "Mark Ready", color: "bg-green-500 text-white" }],
  READY:     [{ status: "SERVED", label: "Mark Picked Up", color: "bg-teal-500 text-white" }],
  SERVED:    [{ status: "PAID", label: "Mark Paid", color: "bg-gray-800 text-white" }],
}

const TABS = [
  { key: "ALL",       label: "All" },
  { key: "PENDING",   label: "Pending" },
  { key: "ACTIVE",    label: "In Progress" },
  { key: "READY",     label: "Ready" },
  { key: "DELIVERY",  label: "Delivery" },
  { key: "TAKEAWAY",  label: "Takeaway" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
]

function timeAgo(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function OrderDetailSheet({ order, onClose, onStatusChange }: {
  order: Order
  onClose: () => void
  onStatusChange: (id: string, status: OrderStatus, eta?: number) => Promise<void>
}) {
  const [eta, setEta] = useState(20)
  const nexts = NEXT_STATUSES[order.status] ?? []
  const canCancel = !["PAID", "CANCELLED"].includes(order.status)

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <p className="font-bold text-gray-900 text-lg">#{order.orderNumber}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                {order.status}
              </span>
              {order.orderType === "TAKEAWAY" && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3" /> TAKEAWAY
                </span>
              )}
              {order.orderType === "DELIVERY" && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                  <Truck className="w-3 h-3" /> DELIVERY
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-5">
          {/* Pickup code */}
          {order.pickupCode && ["CONFIRMED", "PREPARING", "READY", "SERVED", "PAID"].includes(order.status) && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-xs text-green-600 font-medium mb-1">Pickup Code</p>
              <p className="text-3xl font-black text-green-700 tracking-widest">{order.pickupCode}</p>
            </div>
          )}

          {/* Scheduled */}
          {order.scheduledFor && (
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
              <Calendar className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-xs text-purple-600 font-medium">Scheduled for</p>
                <p className="text-sm font-semibold text-purple-800">
                  {new Date(order.scheduledFor).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Customer */}
          {order.customer && (
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 font-medium mb-1">Customer</p>
              <p className="font-semibold text-gray-900">{order.customer.name}</p>
              <p className="text-sm text-gray-600">{order.customer.phone}</p>
            </div>
          )}

          {/* Delivery address */}
          {order.deliveryAddress && (
            <div className="bg-blue-50 rounded-xl px-4 py-3">
              <p className="text-xs text-blue-600 font-medium mb-1">Delivery Address</p>
              <p className="text-sm text-blue-900">{order.deliveryAddress}</p>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2">Items</p>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between">
                  <div className="flex-1 mr-3">
                    <p className="text-sm font-medium text-gray-900">
                      {item.menuItem?.name ?? item.name ?? "Item"}
                    </p>
                    {item.variantName && <p className="text-xs text-gray-400">{item.variantName}</p>}
                    {item.addons?.map((a, i) => (
                      <p key={i} className="text-xs text-gray-400">+ {a.name}</p>
                    ))}
                    {item.notes && <p className="text-xs text-gray-400 italic">{item.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">×{item.quantity}</p>
                    <p className="text-sm font-semibold text-gray-900">₹{Number(item.totalPrice).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bill */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
            <p className="text-xs text-gray-500 font-medium mb-2">Bill Summary</p>
            <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>₹{Number(order.subtotal).toFixed(2)}</span></div>
            <div className="flex justify-between text-sm text-gray-600"><span>Tax</span><span>₹{Number(order.tax).toFixed(2)}</span></div>
            {Number(order.serviceCharge) > 0 && <div className="flex justify-between text-sm text-gray-600"><span>Service charge</span><span>₹{Number(order.serviceCharge).toFixed(2)}</span></div>}
            {Number(order.deliveryFee) > 0 && <div className="flex justify-between text-sm text-gray-600"><span>Delivery fee</span><span>₹{Number(order.deliveryFee).toFixed(2)}</span></div>}
            {Number(order.packagingFee) > 0 && <div className="flex justify-between text-sm text-gray-600"><span>Packaging fee</span><span>₹{Number(order.packagingFee).toFixed(2)}</span></div>}
            {Number(order.tip) > 0 && <div className="flex justify-between text-sm text-gray-600"><span>Tip</span><span>₹{Number(order.tip).toFixed(2)}</span></div>}
            {Number(order.couponDiscount) > 0 && <div className="flex justify-between text-sm text-green-600"><span>Coupon</span><span>−₹{Number(order.couponDiscount).toFixed(2)}</span></div>}
            <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-gray-900"><span>Total</span><span>₹{Number(order.total).toFixed(2)}</span></div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-200 space-y-2 bg-white">
          {nexts.map((n) => (
            <div key={n.status}>
              {n.status === "CONFIRMED" && (
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="text-xs text-gray-500 font-medium whitespace-nowrap">ETA (mins)</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={eta}
                    onChange={(e) => setEta(Number(e.target.value))}
                    className="w-20 text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              )}
              <button
                onClick={() => onStatusChange(order.id, n.status, n.status === "CONFIRMED" ? eta : undefined)}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${n.color}`}
              >
                {n.label}
              </button>
            </div>
          ))}
          {canCancel && !nexts.find((n) => n.status === "CANCELLED") && (
            <button
              onClick={() => onStatusChange(order.id, "CANCELLED")}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
            >
              Cancel Order
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function OnlineOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("ALL")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const accessToken = useAuthStore((s) => s.accessToken)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch<{ data: Order[] } | Order[]>(
        "/orders?orderSource=ONLINE&limit=100"
      )
      const raw: Order[] = Array.isArray(res) ? res : (res as any).data ?? []
      setOrders(raw)
    } catch {
      toast.error("Failed to load online orders")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Real-time updates
  useEffect(() => {
    if (!accessToken) return
    const socket = getSocket(accessToken)

    function onOrderCreated(o: Order) {
      if (o.orderSource !== "ONLINE") return
      setOrders((prev) => [o, ...prev.filter((x) => x.id !== o.id)])
    }
    function onOrderUpdated(o: Order) {
      setOrders((prev) => prev.map((x) => x.id === o.id ? o : x))
      if (selectedOrder?.id === o.id) setSelectedOrder(o)
    }

    socket.on("order.created", onOrderCreated)
    socket.on("order.status_changed", onOrderUpdated)
    return () => {
      socket.off("order.created", onOrderCreated)
      socket.off("order.status_changed", onOrderUpdated)
    }
  }, [accessToken, selectedOrder?.id])

  async function handleStatusChange(id: string, status: OrderStatus, eta?: number) {
    try {
      const updated = await apiFetch<Order>(`/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(status === "CONFIRMED" && eta ? { eta } : {}) }),
      })
      setOrders((prev) => prev.map((o) => o.id === id ? updated : o))
      if (selectedOrder?.id === id) setSelectedOrder(updated)
      toast.success(`Order ${status.toLowerCase()}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update order")
    }
  }

  // Filter
  const filtered = orders.filter((o) => {
    if (activeTab === "ALL") return true
    if (activeTab === "PENDING") return o.status === "PENDING"
    if (activeTab === "ACTIVE") return ["CONFIRMED", "PREPARING"].includes(o.status)
    if (activeTab === "READY") return o.status === "READY"
    if (activeTab === "DELIVERY") return o.orderType === "DELIVERY"
    if (activeTab === "TAKEAWAY") return o.orderType === "TAKEAWAY"
    if (activeTab === "SCHEDULED") return !!o.scheduledFor && !["CANCELLED", "PAID"].includes(o.status)
    if (activeTab === "COMPLETED") return ["SERVED", "PAID"].includes(o.status)
    if (activeTab === "CANCELLED") return o.status === "CANCELLED"
    return true
  })

  // Stats
  const today = new Date().toDateString()
  const todayOrders = orders.filter((o) => new Date(o.createdAt).toDateString() === today)
  const stats = [
    { label: "Today", value: todayOrders.length, color: "text-gray-900" },
    { label: "Pending", value: orders.filter((o) => o.status === "PENDING").length, color: "text-yellow-600" },
    { label: "In Progress", value: orders.filter((o) => ["CONFIRMED", "PREPARING"].includes(o.status)).length, color: "text-blue-600" },
    { label: "Ready", value: orders.filter((o) => o.status === "READY").length, color: "text-green-600" },
  ]

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + refresh */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? "bg-orange-500 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">No orders in this view</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Order</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Items</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Time</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const nexts = NEXT_STATUSES[order.status] ?? []
                const canCancel = !["PAID", "CANCELLED"].includes(order.status)
                const primary = nexts[0]
                return (
                  <tr
                    key={order.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">#{order.orderNumber?.slice(-8)}</p>
                      {order.pickupCode && ["CONFIRMED", "PREPARING", "READY", "SERVED", "PAID"].includes(order.status) && (
                        <p className="text-xs text-green-600 font-bold">{order.pickupCode}</p>
                      )}
                      {order.scheduledFor && (
                        <p className="text-xs text-purple-600 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(order.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {order.orderType === "TAKEAWAY" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          <ShoppingBag className="w-3 h-3" /> Takeaway
                        </span>
                      ) : order.orderType === "DELIVERY" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          <Truck className="w-3 h-3" /> Delivery
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Dine-in</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {order.customer ? (
                        <div>
                          <p className="font-medium text-gray-900">{order.customer.name}</p>
                          <p className="text-xs text-gray-400">{order.customer.phone}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {order.items.slice(0, 2).map((i) => i.menuItem?.name ?? i.name ?? "Item").join(", ")}
                      {order.items.length > 2 && <span className="text-gray-400"> +{order.items.length - 2} more</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">₹{Number(order.total).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{timeAgo(order.createdAt)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {primary && (
                          <button
                            onClick={() => handleStatusChange(order.id, primary.status)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${primary.color}`}
                          >
                            {primary.label}
                          </button>
                        )}
                        {canCancel && !nexts.find((n) => n.status === "CANCELLED") && (
                          <button
                            onClick={() => handleStatusChange(order.id, "CANCELLED")}
                            className="px-2 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail sheet */}
      {selectedOrder && (
        <OrderDetailSheet
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
