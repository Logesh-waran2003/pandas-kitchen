"use client"

import { useEffect, useState, useCallback } from "react"
import { apiFetch } from "@/lib/api"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { Plus, X, ChevronDown, Eye, ShoppingBag, ArrowRightLeft, Receipt, GitMerge, Pencil } from "lucide-react"
import { getSocket } from "@/lib/socket"
import { useAuthStore } from "@/stores/auth.store"

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "PAID"
  | "CANCELLED"

interface Branch { id: string; name: string }
interface TableOption { id: string; tableNumber: string }
interface OrderItem { id: string; menuItemId: string; name: string; quantity: number; unitPrice: number; totalPrice: number; notes?: string }
interface Order {
  id: string
  orderNumber?: string
  tableId?: string
  tableNumber?: number
  branchId: string
  branchName?: string
  status: OrderStatus
  orderType?: string
  totalAmount: number
  paxCount?: number
  notes?: string
  items: OrderItem[]
  createdAt: string
}
interface MenuItemOption { id: string; name: string; price: number; categoryName?: string }

const STATUS_TABS: (OrderStatus | "ALL")[] = [
  "ALL", "PENDING", "CONFIRMED", "PREPARING", "READY", "SERVED", "PAID", "CANCELLED",
]

const STATUS_BADGE: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-orange-100 text-orange-700",
  READY: "bg-green-100 text-green-700",
  SERVED: "bg-teal-100 text-teal-700",
  PAID: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
}

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: ["PAID"],
  PAID: [],
  CANCELLED: [],
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[status]}`}>
      {status}
    </span>
  )
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} p-6 relative max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

function ViewOrderModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <Modal title={`Order #${order.orderNumber ?? order.id.slice(-6).toUpperCase()}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>Table: <strong>{order.tableNumber ?? "—"}</strong></span>
          <span>Branch: <strong>{order.branchName ?? "—"}</strong></span>
          <span>Time: <strong>{formatDate(order.createdAt)}</strong></span>
          {order.paxCount && order.paxCount > 1 && (
            <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {order.paxCount} covers
            </span>
          )}
          <StatusBadge status={order.status} />
        </div>
        {order.notes && <p className="text-sm text-gray-500 italic">"{order.notes}"</p>}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-gray-500 font-medium">Item</th>
              <th className="text-right py-2 text-gray-500 font-medium">Qty</th>
              <th className="text-right py-2 text-gray-500 font-medium">Unit</th>
              <th className="text-right py-2 text-gray-500 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2">
                  <span>{item.name}</span>
                  {item.notes && <span className="text-gray-400 ml-1 text-xs">({item.notes})</span>}
                </td>
                <td className="text-right py-2">{item.quantity}</td>
                <td className="text-right py-2">{formatCurrency(item.unitPrice)}</td>
                <td className="text-right py-2 font-medium">{formatCurrency(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="text-right py-3 font-semibold text-gray-900">Total</td>
              <td className="text-right py-3 font-bold text-orange-600">{formatCurrency(order.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Modal>
  )
}

interface NewOrderLine { menuItemId: string; name: string; price: number; quantity: number; notes: string }

function MergeTablesModal({ orders, onClose, onMerged }: { orders: Order[]; onClose: () => void; onMerged: () => void }) {
  const activeOrders = orders.filter((o) => !["PAID", "CANCELLED"].includes(o.status) && o.orderType === "DINE_IN")
  const [primaryId, setPrimaryId] = useState(activeOrders[0]?.id ?? "")
  const [secondaryId, setSecondaryId] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleMerge() {
    if (!primaryId || !secondaryId) { toast.error("Select both orders"); return }
    if (primaryId === secondaryId) { toast.error("Orders must be different"); return }
    setSaving(true)
    try {
      await apiFetch("/tables/merge", {
        method: "POST",
        body: JSON.stringify({ primaryOrderId: primaryId, secondaryOrderId: secondaryId }),
      })
      toast.success("Tables merged")
      onMerged()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Merge failed")
    } finally {
      setSaving(false)
    }
  }

  const selectCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"

  return (
    <Modal title="Merge Tables" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Items from the secondary order will be moved into the primary order. The secondary order will be cancelled and its table freed.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Keep this order (primary)</label>
          <select value={primaryId} onChange={(e) => setPrimaryId(e.target.value)} className={selectCls}>
            <option value="">— Select primary order —</option>
            {activeOrders.map((o) => (
              <option key={o.id} value={o.id}>
                #{o.orderNumber ?? o.id.slice(-6).toUpperCase()} · T{o.tableNumber ?? "—"} · {o.items.length} items
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Merge into it from (secondary)</label>
          <select value={secondaryId} onChange={(e) => setSecondaryId(e.target.value)} className={selectCls}>
            <option value="">— Select secondary order —</option>
            {activeOrders
              .filter((o) => o.id !== primaryId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.orderNumber ?? o.id.slice(-6).toUpperCase()} · T{o.tableNumber ?? "—"} · {o.items.length} items
                </option>
              ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            onClick={handleMerge}
            disabled={saving || !primaryId || !secondaryId}
            className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-60"
          >
            {saving ? "Merging…" : "Merge Tables"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function TransferTableModal({ order, onClose, onTransferred }: { order: Order; onClose: () => void; onTransferred: () => void }) {
  const [tables, setTables] = useState<TableOption[]>([])
  const [newTableId, setNewTableId] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch<TableOption[]>(`/tables?branchId=${order.branchId}`)
      .then(all => setTables(all.filter(t => t.id !== order.tableId)))
      .catch(() => {})
  }, [order.branchId, order.tableId])

  async function handleTransfer() {
    if (!newTableId) { toast.error("Select a table"); return }
    setSaving(true)
    try {
      await apiFetch("/tables/transfer", {
        method: "PATCH",
        body: JSON.stringify({ orderId: order.id, newTableId }),
      })
      toast.success("Order transferred to new table")
      onTransferred()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transfer failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Transfer Order #${order.orderNumber ?? order.id.slice(-6).toUpperCase()}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Current table: <strong>{order.tableNumber ? `T${order.tableNumber}` : "— none —"}</strong>
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Move to table</label>
          <select
            value={newTableId}
            onChange={e => setNewTableId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">— Select available table —</option>
            {tables.map(t => (
              <option key={t.id} value={t.id}>{t.tableNumber}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            onClick={handleTransfer}
            disabled={saving || !newTableId}
            className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-60"
          >
            {saving ? "Transferring…" : "Transfer"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [tables, setTables] = useState<TableOption[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([])
  const [branchId, setBranchId] = useState("")
  const [tableId, setTableId] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<NewOrderLine[]>([])
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch<Branch[]>("/settings/branches").then((data) => {
      setBranches(data)
      if (data.length > 0) setBranchId(data[0].id)
    }).catch(() => {})
    apiFetch<MenuItemOption[]>("/menu/items").then(setMenuItems).catch(() => {})
  }, [])

  useEffect(() => {
    if (!branchId) return
    setTableId("")
    apiFetch<TableOption[]>(`/tables?branchId=${branchId}`).then(setTables).catch(() => {})
  }, [branchId])

  const filtered = search
    ? menuItems.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : []

  function addItem(item: MenuItemOption) {
    setLines((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id)
      if (existing) return prev.map((l) => l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l)
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, notes: "" }]
    })
    setSearch("")
  }

  function updateLine(idx: number, field: keyof NewOrderLine, value: string | number) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  const total = lines.reduce((sum, l) => sum + l.price * l.quantity, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (lines.length === 0) { toast.error("Add at least one item"); return }
    setSaving(true)
    try {
      await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          tableId: tableId || undefined,
          notes: notes || undefined,
          items: lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, notes: l.notes || undefined })),
        }),
      })
      toast.success("Order created")
      onCreated()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create order")
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"

  return (
    <Modal title="New Order" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch <span className="text-red-500">*</span></label>
            <select required value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Table (optional)</label>
            <select value={tableId} onChange={(e) => setTableId(e.target.value)} className={inputCls}>
              <option value="">— No table —</option>
              {tables.map((t) => <option key={t.id} value={t.id}>{t.tableNumber}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none`} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Add Items</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search menu items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputCls}
            />
            {filtered.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 flex justify-between"
                  >
                    <span>{item.name}</span>
                    <span className="text-gray-500">{formatCurrency(item.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {lines.length > 0 && (
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Item</th>
                  <th className="text-center px-2 py-2 text-gray-500 font-medium w-20">Qty</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Subtotal</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={line.menuItemId} className="border-t border-gray-100">
                    <td className="px-3 py-2">{line.name}<div className="text-xs text-gray-400">{formatCurrency(line.price)} ea</div></td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(i, "quantity", parseInt(e.target.value) || 1)}
                        className="w-16 text-center border border-gray-200 rounded px-1 py-0.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(line.price * line.quantity)}</td>
                    <td className="px-1">
                      <button type="button" onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-500 p-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td colSpan={2} className="px-3 py-2 font-semibold text-right text-gray-700">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-orange-600">{formatCurrency(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-60">
            {saving ? "Creating…" : "Create Order"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EditOrderModal({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const [lines, setLines] = useState<NewOrderLine[]>(
    order.items.map((i) => ({ menuItemId: i.menuItemId, name: i.name, price: i.unitPrice, quantity: i.quantity, notes: i.notes ?? "" }))
  )
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([])
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch<MenuItemOption[]>("/menu/items").then(setMenuItems).catch(() => {})
  }, [])

  const filtered = search
    ? menuItems.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : []

  function addItem(item: MenuItemOption) {
    setLines((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id)
      if (existing) return prev.map((l) => l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l)
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, notes: "" }]
    })
    setSearch("")
  }

  function updateQty(idx: number, delta: number) {
    setLines((prev) => {
      const next = prev.map((l, i) => i === idx ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l)
      return next
    })
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  const total = lines.reduce((sum, l) => sum + l.price * l.quantity, 0)

  async function handleSave() {
    if (lines.length === 0) { toast.error("Order must have at least one item"); return }
    setSaving(true)
    try {
      await apiFetch(`/orders/${order.id}/edit`, {
        method: "PATCH",
        body: JSON.stringify({
          items: lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, notes: l.notes || undefined })),
        }),
      })
      toast.success("Order updated")
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update order")
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"

  return (
    <Modal title={`Edit Order #${order.orderNumber ?? order.id.slice(-6).toUpperCase()}`} onClose={onClose} wide>
      <div className="space-y-4">
        {/* Current items */}
        {lines.length > 0 && (
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Item</th>
                  <th className="text-center px-2 py-2 text-gray-500 font-medium w-24">Qty</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Subtotal</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={`${line.menuItemId}-${i}`} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      {line.name}
                      <div className="text-xs text-gray-400">{formatCurrency(line.price)} ea</div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQty(i, -1)}
                          className="w-6 h-6 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm"
                        >−</button>
                        <span className="w-5 text-center">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(i, 1)}
                          className="w-6 h-6 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm"
                        >+</button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(line.price * line.quantity)}</td>
                    <td className="px-1">
                      <button type="button" onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-500 p-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td colSpan={2} className="px-3 py-2 font-semibold text-right text-gray-700">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-orange-600">{formatCurrency(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Add item search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Add Item</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search menu items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputCls}
            />
            {filtered.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 flex justify-between"
                  >
                    <span>{item.name}</span>
                    <span className="text-gray-500">{formatCurrency(item.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<OrderStatus | "ALL">("ALL")
  const [viewOrder, setViewOrder] = useState<Order | null>(null)
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [transferOrder, setTransferOrder] = useState<Order | null>(null)
  const [showMerge, setShowMerge] = useState(false)
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const accessToken = useAuthStore((s) => s.accessToken)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = activeTab === "ALL" ? "/orders" : `/orders?status=${activeTab}`
      const res = await apiFetch<{ data: Order[]; meta: unknown } | Order[]>(url)
      const orders = Array.isArray(res) ? res : (res as any).data ?? []
      setOrders(orders)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders")
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => { load() }, [load])

  // Socket.io — live order updates
  useEffect(() => {
    if (!accessToken) return

    const socket = getSocket(accessToken)

    function onOrderCreated(newOrder: Order) {
      // Only prepend if current tab would show this order
      setOrders((prev) => {
        if (activeTab !== "ALL" && newOrder.status !== activeTab) return prev
        // Avoid duplicates
        if (prev.some((o) => o.id === newOrder.id)) return prev
        toast.info(`New order: #${newOrder.orderNumber ?? newOrder.id.slice(-6).toUpperCase()}`)
        return [newOrder, ...prev]
      })
    }

    function onOrderStatusChanged(data: { id: string; status: OrderStatus }) {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== data.id) return o
          // Remove from list if current tab filter no longer matches
          if (activeTab !== "ALL" && data.status !== activeTab) return { ...o, status: data.status }
          return { ...o, status: data.status }
        }),
      )
    }

    function onOrderCancelled(data: { id: string }) {
      setOrders((prev) =>
        prev.map((o) => (o.id === data.id ? { ...o, status: "CANCELLED" as OrderStatus } : o)),
      )
    }

    socket.on("order.created", onOrderCreated)
    socket.on("order.status_changed", onOrderStatusChanged)
    socket.on("order.cancelled", onOrderCancelled)

    return () => {
      socket.off("order.created", onOrderCreated)
      socket.off("order.status_changed", onOrderStatusChanged)
      socket.off("order.cancelled", onOrderCancelled)
    }
  }, [accessToken, activeTab])

  async function updateStatus(order: Order, status: OrderStatus) {
    setUpdatingId(order.id)
    try {
      await apiFetch(`/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) })
      toast.success(`Order ${status.toLowerCase()}`)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update")
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMerge(true)}
            className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg"
          >
            <GitMerge className="w-4 h-4" /> Merge Tables
          </button>
          <button
            onClick={() => setShowNewOrder(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            <Plus className="w-4 h-4" /> New Order
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab
                ? "bg-orange-500 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {error ? (
        <div className="border border-red-200 bg-red-50 rounded-xl p-5 flex items-center justify-between">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={load} className="text-sm font-medium text-red-600 hover:text-red-800 underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-gray-100 px-6 flex items-center gap-4">
              <div className="h-3 w-20 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <ShoppingBag className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-medium">No orders found</p>
          <button onClick={() => setShowNewOrder(true)} className="mt-3 flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-2 rounded-lg">
            <Plus className="w-4 h-4" /> Create First Order
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Order #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Table</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Items</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Time</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const nexts = NEXT_STATUSES[order.status]
                const canCancel = !["PAID", "CANCELLED"].includes(order.status)
                return (
                  <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      #{order.orderNumber ?? order.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {order.tableNumber ? `T${order.tableNumber}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {order.items.length} items
                      {order.paxCount && order.paxCount > 1 && (
                        <span className="ml-1.5 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
                          {order.paxCount} cvr
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(order.totalAmount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(order.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewOrder(order)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {["PENDING", "CONFIRMED"].includes(order.status) && (
                          <button
                            onClick={() => setEditOrder(order)}
                            className="p-1.5 rounded hover:bg-gray-100 text-blue-500"
                            title="Edit order"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {order.status === "PAID" && (
                          <button
                            onClick={() => window.open(`/orders/${order.id}/receipt`, "_blank")}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                            title="View receipt"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                        )}
                        {!["PAID", "CANCELLED"].includes(order.status) && order.orderType === "DINE_IN" && (
                          <button
                            onClick={() => setTransferOrder(order)}
                            className="p-1.5 rounded hover:bg-gray-100 text-orange-500"
                            title="Transfer table"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                        )}
                        {nexts.length > 0 && (
                          <div className="relative group">
                            <button
                              disabled={updatingId === order.id}
                              className="flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Update <ChevronDown className="w-3 h-3" />
                            </button>
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 hidden group-hover:block min-w-[140px]">
                              {nexts.map((s) => (
                                <button
                                  key={s}
                                  onClick={() => updateStatus(order, s)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 hover:text-orange-700"
                                >
                                  → {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {canCancel && !nexts.includes("CANCELLED") && (
                          <button
                            onClick={() => updateStatus(order, "CANCELLED")}
                            disabled={updatingId === order.id}
                            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
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
        </div>
      )}

      {viewOrder && <ViewOrderModal order={viewOrder} onClose={() => setViewOrder(null)} />}
      {showNewOrder && <NewOrderModal onClose={() => setShowNewOrder(false)} onCreated={load} />}
      {editOrder && <EditOrderModal order={editOrder} onClose={() => setEditOrder(null)} onSaved={load} />}
      {transferOrder && <TransferTableModal order={transferOrder} onClose={() => setTransferOrder(null)} onTransferred={load} />}
      {showMerge && <MergeTablesModal orders={orders} onClose={() => setShowMerge(false)} onMerged={load} />}
    </div>
  )
}
