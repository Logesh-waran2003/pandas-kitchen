"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { apiFetch } from "@/lib/api"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { Search, Plus, Eye, Pencil, UserX, UserCheck, X, Users } from "lucide-react"

interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  totalOrders: number
  totalSpent: number
  loyaltyPoints: number
  isActive: boolean
  createdAt: string
}

interface CustomerOrder {
  id: string
  orderNumber: string
  totalAmount: number
  status: string
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORDER_STATUS_BADGE: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-600",
  PENDING: "bg-yellow-100 text-yellow-700",
}

function orderStatusBadge(status: string) {
  return ORDER_STATUS_BADGE[status] ?? "bg-blue-100 text-blue-700"
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Add / Edit Customer Modal ────────────────────────────────────────────────

function CustomerModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Customer | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(editing?.name ?? "")
  const [phone, setPhone] = useState(editing?.phone ?? "")
  const [email, setEmail] = useState(editing?.email ?? "")
  const [address, setAddress] = useState(editing?.address ?? "")
  const [saving, setSaving] = useState(false)

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name,
      phone,
      email: email || undefined,
      address: address || undefined,
    }
    try {
      if (editing) {
        await apiFetch(`/customers/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        toast.success("Customer updated")
      } else {
        await apiFetch("/customers", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        toast.success("Customer added")
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={editing ? "Edit Customer" : "Add Customer"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <textarea
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={`${inputCls} resize-none`}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-60"
          >
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Customer"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Customer Detail Panel ────────────────────────────────────────────────────

function CustomerPanel({
  customer,
  onClose,
}: {
  customer: Customer
  onClose: () => void
}) {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)

  useEffect(() => {
    setOrdersLoading(true)
    apiFetch<CustomerOrder[]>(`/customers/${customer.id}/orders`)
      .then(setOrders)
      .catch(() => toast.error("Failed to load order history"))
      .finally(() => setOrdersLoading(false))
  }, [customer.id])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-30"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{customer.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info section */}
        <div className="px-5 py-4 border-b border-gray-200 space-y-2">
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">Phone: </span>{customer.phone}
          </div>
          {customer.email && (
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">Email: </span>{customer.email}
            </div>
          )}
          {customer.address && (
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">Address: </span>{customer.address}
            </div>
          )}
          <div className="flex items-center gap-4 pt-1">
            <div className="text-sm">
              <span className="text-gray-500">Total Spent</span>
              <p className="font-semibold text-gray-900">{formatCurrency(customer.totalSpent)}</p>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Loyalty Points</span>
              <p className={`font-semibold ${customer.loyaltyPoints > 0 ? "text-orange-600" : "text-gray-900"}`}>
                {customer.loyaltyPoints} pts
              </p>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Orders</span>
              <p className="font-semibold text-gray-900">{customer.totalOrders}</p>
            </div>
          </div>
        </div>

        {/* Order history */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">Order History</span>
          </div>

          {ordersLoading ? (
            <div className="px-5 py-3 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse space-y-1.5">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <p className="text-sm">No orders yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {orders.map((order) => (
                <div key={order.id} className="px-5 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">#{order.orderNumber}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${orderStatusBadge(order.status)}`}
                    >
                      {order.status}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">
                      {formatCurrency(order.totalAmount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadCustomers = useCallback(async (q = "") => {
    setLoading(true)
    setError(null)
    try {
      const url = q ? `/customers?search=${encodeURIComponent(q)}` : "/customers"
      const data = await apiFetch<Customer[]>(url)
      setCustomers(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load customers")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadCustomers(value)
    }, 400)
  }

  async function toggleActive(customer: Customer) {
    if (!customer.isActive) {
      // Reactivate — no confirm needed
    } else {
      if (!window.confirm(`Deactivate "${customer.name}"? They will no longer be able to place orders.`)) return
    }
    setTogglingId(customer.id)
    try {
      await apiFetch(`/customers/${customer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !customer.isActive }),
      })
      toast.success(customer.isActive ? "Customer deactivated" : "Customer activated")
      loadCustomers(search)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update")
    } finally {
      setTogglingId(null)
    }
  }

  function openAdd() {
    setEditingCustomer(null)
    setShowModal(true)
  }

  function openEdit(customer: Customer) {
    setEditingCustomer(customer)
    setShowModal(true)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <div className="flex items-center gap-3 ml-auto">
          {/* Search */}
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone, email…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-5 flex items-center justify-between">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={() => loadCustomers(search)}
            className="text-sm font-medium text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!error && (
        <>
          {loading ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Name", "Phone", "Email", "Total Orders", "Total Spent", "Loyalty Points", "Status", "Actions"].map(
                      (h) => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-gray-500">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Users className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium text-gray-500">No customers found</p>
              <button
                onClick={openAdd}
                className="mt-3 flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-2 rounded-lg"
              >
                <Plus className="w-4 h-4" /> Add Customer
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {(() => {
                const totalPages = Math.ceil(customers.length / PAGE_SIZE)
                const safePage = Math.min(page, totalPages || 1)
                const start = (safePage - 1) * PAGE_SIZE
                const paged = customers.slice(start, start + PAGE_SIZE)
                const from = customers.length === 0 ? 0 : start + 1
                const to = Math.min(start + PAGE_SIZE, customers.length)
                return (
                  <>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Orders</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Total Spent</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Points</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((customer) => (
                    <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{customer.name}</td>
                      <td className="px-4 py-3 text-gray-600">{customer.phone}</td>
                      <td className="px-4 py-3 text-gray-500">{customer.email ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{customer.totalOrders}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatCurrency(customer.totalSpent)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            customer.loyaltyPoints > 0 ? "text-orange-600 font-medium" : "text-gray-500"
                          }
                        >
                          {customer.loyaltyPoints} pts
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {customer.isActive ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewCustomer(customer)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(customer)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleActive(customer)}
                            disabled={togglingId === customer.id}
                            className={`p-1.5 rounded disabled:opacity-50 ${
                              customer.isActive
                                ? "hover:bg-red-50 text-red-400"
                                : "hover:bg-green-50 text-green-500"
                            }`}
                            title={customer.isActive ? "Deactivate" : "Activate"}
                          >
                            {customer.isActive ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination */}
              {customers.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-gray-500">
                  <span>Showing {from}–{to} of {customers.length} customers</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Prev
                    </button>
                    <span className="text-gray-700 font-medium">{safePage} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
                  </>
                )
              })()}
            </div>
          )}
        </>
      )}

      {/* Add/Edit modal */}
      {showModal && (
        <CustomerModal
          editing={editingCustomer}
          onClose={() => setShowModal(false)}
          onSaved={() => loadCustomers(search)}
        />
      )}

      {/* Detail side panel */}
      {viewCustomer && (
        <CustomerPanel customer={viewCustomer} onClose={() => setViewCustomer(null)} />
      )}
    </div>
  )
}
