"use client"

import { useEffect, useState, useRef } from "react"
import { apiFetch } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, X, UtensilsCrossed } from "lucide-react"

interface Category {
  id: string
  name: string
  description?: string
  itemCount?: number
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
  preparationTime?: number
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="animate-pulse px-3 py-3 rounded-lg space-y-1">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="animate-pulse bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="h-32 bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/3" />
      </div>
    </div>
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

// ─── Category Modal ───────────────────────────────────────────────────────────

function CategoryModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Category | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(editing?.name ?? "")
  const [description, setDescription] = useState(editing?.description ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await apiFetch(`/menu/categories/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, description }),
        })
        toast.success("Category updated")
      } else {
        await apiFetch("/menu/categories", {
          method: "POST",
          body: JSON.stringify({ name, description }),
        })
        toast.success("Category added")
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
    <Modal title={editing ? "Edit Category" : "Add Category"} onClose={onClose}>
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
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
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
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Category"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Item Modal ───────────────────────────────────────────────────────────────

function ItemModal({
  editing,
  categories,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  editing: MenuItem | null
  categories: Category[]
  defaultCategoryId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [categoryId, setCategoryId] = useState(
    editing?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? ""
  )
  const [name, setName] = useState(editing?.name ?? "")
  const [price, setPrice] = useState(editing?.price?.toString() ?? "")
  const [description, setDescription] = useState(editing?.description ?? "")
  const [isVeg, setIsVeg] = useState(editing?.isVeg ?? false)
  const [preparationTime, setPreparationTime] = useState(
    editing?.preparationTime?.toString() ?? ""
  )
  const [isAvailable, setIsAvailable] = useState(editing?.isAvailable ?? true)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      categoryId,
      name,
      price: parseFloat(price),
      description: description || undefined,
      isVeg,
      preparationTime: preparationTime ? parseInt(preparationTime) : undefined,
      isAvailable,
    }
    try {
      if (editing) {
        await apiFetch(`/menu/items/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        toast.success("Item updated")
      } else {
        await apiFetch("/menu/items", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        toast.success("Item added")
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
    <Modal title={editing ? "Edit Item" : "Add Item"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price (₹) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Preparation Time (minutes)
          </label>
          <input
            type="number"
            min="0"
            value={preparationTime}
            onChange={(e) => setPreparationTime(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="flex items-center gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isVeg}
              onChange={(e) => setIsVeg(e.target.checked)}
              className="accent-green-500"
            />
            Vegetarian
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="accent-orange-500"
            />
            Available
          </label>
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
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Item"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [catLoading, setCatLoading] = useState(true)
  const [catError, setCatError] = useState<string | null>(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)

  const [catModal, setCatModal] = useState<false | Category | null>(false)
  const [itemModal, setItemModal] = useState<false | MenuItem | null>(false)

  const togglingRef = useRef<Set<string>>(new Set())
  const [, forceUpdate] = useState(0)

  async function loadCategories() {
    setCatLoading(true)
    setCatError(null)
    try {
      const data = await apiFetch<Category[]>("/menu/categories")
      setCategories(data)
      if (!selectedCategoryId && data.length > 0) {
        setSelectedCategoryId(data[0].id)
      }
    } catch (e) {
      setCatError(e instanceof Error ? e.message : "Failed to load categories")
    } finally {
      setCatLoading(false)
    }
  }

  async function loadItems(categoryId: string) {
    setItemsLoading(true)
    setItemsError(null)
    try {
      const data = await apiFetch<MenuItem[]>(`/menu/items?categoryId=${categoryId}`)
      setItems(data)
    } catch (e) {
      setItemsError(e instanceof Error ? e.message : "Failed to load items")
    } finally {
      setItemsLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (selectedCategoryId) loadItems(selectedCategoryId)
  }, [selectedCategoryId])

  async function deleteCategory(cat: Category) {
    if (!window.confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return
    try {
      await apiFetch(`/menu/categories/${cat.id}`, { method: "DELETE" })
      toast.success("Category deleted")
      if (selectedCategoryId === cat.id) setSelectedCategoryId(null)
      loadCategories()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete")
    }
  }

  async function deleteItem(item: MenuItem) {
    if (!window.confirm(`Delete "${item.name}"?`)) return
    try {
      await apiFetch(`/menu/items/${item.id}`, { method: "DELETE" })
      toast.success("Item deleted")
      if (selectedCategoryId) loadItems(selectedCategoryId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete")
    }
  }

  async function toggleAvailability(item: MenuItem) {
    if (togglingRef.current.has(item.id)) return
    togglingRef.current.add(item.id)
    forceUpdate((n) => n + 1)
    try {
      await apiFetch(`/menu/items/${item.id}/toggle`, { method: "PATCH" })
      if (selectedCategoryId) loadItems(selectedCategoryId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to toggle")
    } finally {
      togglingRef.current.delete(item.id)
      forceUpdate((n) => n + 1)
    }
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null

  return (
    <div className="flex gap-4 h-full">
      {/* ── Left: Categories ── */}
      <div className="w-64 shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={() => setCatModal(null)}
            className="flex items-center gap-2 w-full justify-center bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-2 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {catLoading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          ) : catError ? (
            <div className="p-3 text-center">
              <p className="text-red-500 text-xs">{catError}</p>
              <button
                onClick={loadCategories}
                className="mt-2 text-xs text-orange-500 underline"
              >
                Retry
              </button>
            </div>
          ) : categories.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No categories yet</p>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`group px-3 py-2 rounded-lg cursor-pointer flex items-start justify-between gap-2 ${
                  selectedCategoryId === cat.id
                    ? "bg-orange-50 border-l-2 border-orange-500"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{cat.name}</p>
                    {cat.itemCount !== undefined && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full shrink-0">
                        {cat.itemCount}
                      </span>
                    )}
                  </div>
                  {cat.description && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{cat.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setCatModal(cat)
                    }}
                    className="p-1 hover:bg-gray-100 rounded text-gray-500"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteCategory(cat)
                    }}
                    className="p-1 hover:bg-red-50 rounded text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Items ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedCategory ? selectedCategory.name : "Menu Items"}
          </h2>
          {selectedCategoryId && (
            <button
              onClick={() => setItemModal(null)}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          )}
        </div>

        {/* Content */}
        {!selectedCategoryId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
            <UtensilsCrossed className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Select a category</p>
            <p className="text-sm mt-1">Choose a category from the left to view its items</p>
          </div>
        ) : itemsError ? (
          <div className="border border-red-200 bg-red-50 rounded-xl p-5 flex items-center justify-between">
            <p className="text-red-600 text-sm">{itemsError}</p>
            <button
              onClick={() => loadItems(selectedCategoryId)}
              className="text-sm font-medium text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        ) : itemsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
            <UtensilsCrossed className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">No items yet</p>
            <button
              onClick={() => setItemModal(null)}
              className="mt-3 flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-2 rounded-lg"
            >
              <Plus className="w-4 h-4" /> Add First Item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
              >
                {/* Image or placeholder */}
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-32 object-cover"
                  />
                ) : (
                  <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                    <UtensilsCrossed className="w-8 h-8 text-gray-300" />
                  </div>
                )}

                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{item.name}</p>
                    <span className="flex items-center gap-1 text-xs shrink-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${item.isVeg ? "bg-green-500" : "bg-red-500"}`}
                      />
                      <span className="text-gray-500">{item.isVeg ? "Veg" : "Non-veg"}</span>
                    </span>
                  </div>
                  <p className="text-sm font-medium text-orange-600 mt-1">
                    {formatCurrency(item.price)}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    {/* Availability toggle */}
                    <button
                      onClick={() => toggleAvailability(item)}
                      disabled={togglingRef.current.has(item.id)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                        item.isAvailable ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          item.isAvailable ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setItemModal(item)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteItem(item)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {catModal !== false && (
        <CategoryModal
          editing={catModal}
          onClose={() => setCatModal(false)}
          onSaved={loadCategories}
        />
      )}

      {itemModal !== false && (
        <ItemModal
          editing={itemModal}
          categories={categories}
          defaultCategoryId={selectedCategoryId}
          onClose={() => setItemModal(false)}
          onSaved={() => selectedCategoryId && loadItems(selectedCategoryId)}
        />
      )}
    </div>
  )
}
