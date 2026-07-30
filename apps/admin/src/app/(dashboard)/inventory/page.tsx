"use client"

import { useEffect, useState, useCallback } from "react"
import { apiFetch } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch {
  id: string
  name: string
}

interface InventoryItem {
  id: string
  name: string
  unit: string
  currentStock: number
  minStock: number
  costPerUnit: number
  isLowStock: boolean
  branchId: string
}

type AdjustType = "RESTOCK" | "MANUAL_DEDUCTION" | "WASTE"

// ─── Modal shell ─────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-xl w-full p-6 relative ${wide ? "max-w-lg" : "max-w-md"}`}
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

// ─── Add Item Modal ───────────────────────────────────────────────────────────

function AddItemModal({
  branches,
  selectedBranchId,
  onClose,
  onSaved,
}: {
  branches: Branch[]
  selectedBranchId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [unit, setUnit] = useState("")
  const [currentStock, setCurrentStock] = useState("")
  const [minStock, setMinStock] = useState("")
  const [costPerUnit, setCostPerUnit] = useState("")
  const [branchId, setBranchId] = useState(selectedBranchId)
  const [saving, setSaving] = useState(false)

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiFetch("/inventory", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          name,
          unit,
          currentStock: currentStock ? parseFloat(currentStock) : undefined,
          minStock: minStock ? parseFloat(minStock) : undefined,
          costPerUnit: costPerUnit ? parseFloat(costPerUnit) : undefined,
        }),
      })
      toast.success("Item added")
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add item")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add Inventory Item" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Branch <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={inputCls}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tomatoes"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="kg / litre / piece"
              className={inputCls}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={currentStock}
              onChange={(e) => setCurrentStock(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cost/Unit (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={costPerUnit}
              onChange={(e) => setCostPerUnit(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
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
            {saving ? "Adding…" : "Add Item"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Edit Item Modal ──────────────────────────────────────────────────────────

function EditItemModal({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(item.name)
  const [unit, setUnit] = useState(item.unit)
  const [minStock, setMinStock] = useState(String(item.minStock))
  const [costPerUnit, setCostPerUnit] = useState(String(item.costPerUnit))
  const [saving, setSaving] = useState(false)

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiFetch(`/inventory/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          unit,
          minStock: parseFloat(minStock),
          costPerUnit: parseFloat(costPerUnit),
        }),
      })
      toast.success("Item updated")
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update item")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit Inventory Item" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cost/Unit (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={costPerUnit}
              onChange={(e) => setCostPerUnit(e.target.value)}
              className={inputCls}
            />
          </div>
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
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Adjust Stock Modal ───────────────────────────────────────────────────────

const ADJUST_TYPES: { value: AdjustType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "RESTOCK", label: "Restock", icon: <ArrowUpCircle className="w-4 h-4" />, color: "text-green-600" },
  { value: "MANUAL_DEDUCTION", label: "Manual Deduction", icon: <ArrowDownCircle className="w-4 h-4" />, color: "text-orange-600" },
  { value: "WASTE", label: "Waste", icon: <Trash2 className="w-4 h-4" />, color: "text-red-500" },
]

function AdjustStockModal({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem
  onClose: () => void
  onSaved: () => void
}) {
  const [type, setType] = useState<AdjustType>("RESTOCK")
  const [quantity, setQuantity] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!quantity || parseFloat(quantity) <= 0) {
      toast.error("Quantity must be greater than 0")
      return
    }
    setSaving(true)
    try {
      await apiFetch(`/inventory/${item.id}/adjust`, {
        method: "POST",
        body: JSON.stringify({
          type,
          quantity: parseFloat(quantity),
          note: note || undefined,
        }),
      })
      toast.success("Stock adjusted")
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to adjust stock")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Adjust Stock — ${item.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current stock display */}
        <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-gray-500">Current Stock</span>
          <span className="font-semibold text-gray-800">
            {item.currentStock} {item.unit}
          </span>
        </div>

        {/* Type selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Adjustment Type</label>
          <div className="grid grid-cols-3 gap-2">
            {ADJUST_TYPES.map(({ value, label, icon, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-xs font-medium transition-colors ${
                  type === value
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className={type === value ? "text-orange-600" : color}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity ({item.unit}) <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="number"
            min="0.001"
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Received from supplier"
            className={inputCls}
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
            {saving ? "Adjusting…" : "Adjust Stock"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 animate-pulse">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState("")
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const PAGE_SIZE = 20

  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Load branches on mount
  useEffect(() => {
    apiFetch<Branch[]>("/settings/branches")
      .then((data) => {
        setBranches(data)
        if (data.length > 0) setSelectedBranchId(data[0].id)
      })
      .catch(() => toast.error("Failed to load branches"))
      .finally(() => setBranchesLoading(false))
  }, [])

  const loadItems = useCallback(async () => {
    if (!selectedBranchId) return
    setLoading(true)
    try {
      const data = await apiFetch<InventoryItem[]>(`/inventory?branchId=${selectedBranchId}`)
      setItems(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load inventory")
    } finally {
      setLoading(false)
    }
  }, [selectedBranchId])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  async function handleDelete(item: InventoryItem) {
    if (!window.confirm(`Remove "${item.name}" from inventory?`)) return
    setDeletingId(item.id)
    try {
      await apiFetch(`/inventory/${item.id}`, { method: "DELETE" })
      toast.success("Item removed")
      loadItems()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove item")
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const safePage = Math.min(page, totalPages || 1)
  const pagedItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const fromItem = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const toItem = Math.min(safePage * PAGE_SIZE, filtered.length)

  const lowStockCount = items.filter((i) => i.isLowStock).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          {lowStockCount > 0 && (
            <span className="flex items-center gap-1.5 bg-red-100 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" />
              {lowStockCount} Low Stock
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Branch selector */}
          {!branchesLoading && branches.length > 1 && (
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-48"
            />
          </div>
          <button
            onClick={() => setShowAdd(true)}
            disabled={!selectedBranchId}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Unit</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Current Stock</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Min Stock</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Cost/Unit</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-400 text-sm">
                    {search ? "No items match your search" : "No inventory items yet"}
                  </p>
                  {!search && (
                    <button
                      onClick={() => setShowAdd(true)}
                      className="mt-3 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-2 rounded-lg mx-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Add First Item
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              pagedItems.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${
                    item.isLowStock ? "border-l-2 border-l-red-400" : ""
                  }`}
                >
                  <td className="px-5 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-medium ${
                        item.isLowStock ? "text-red-600" : "text-gray-800"
                      }`}
                    >
                      {item.currentStock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{item.minStock}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {item.costPerUnit > 0 ? formatCurrency(item.costPerUnit) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {item.isLowStock ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                        <AlertTriangle className="w-3 h-3" />
                        Low Stock
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setAdjustItem(item)}
                        className="p-1.5 rounded hover:bg-orange-50 text-orange-500"
                        title="Adjust stock"
                      >
                        <ArrowUpCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditItem(item)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                        title="Edit item"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400 disabled:opacity-50"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>Showing {fromItem}–{toItem} of {filtered.length} items</span>
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
      </div>

      {/* Modals */}
      {showAdd && selectedBranchId && (
        <AddItemModal
          branches={branches}
          selectedBranchId={selectedBranchId}
          onClose={() => setShowAdd(false)}
          onSaved={loadItems}
        />
      )}
      {editItem && (
        <EditItemModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={loadItems}
        />
      )}
      {adjustItem && (
        <AdjustStockModal
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onSaved={loadItems}
        />
      )}
    </div>
  )
}
