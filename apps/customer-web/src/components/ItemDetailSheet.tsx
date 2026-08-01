"use client"
import { useState, useEffect } from "react"
import { X, Plus, Minus, ChevronDown } from "lucide-react"

export interface AddonOption {
  id: string
  name: string
  price: number
}

export interface AddonGroup {
  id: string
  name: string
  minSelect: number
  maxSelect: number
  isRequired: boolean
  addons: AddonOption[]
}

export interface VariantOption {
  id: string
  name: string
  price: number
}

export interface MenuItemDetail {
  id: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  isVeg: boolean
  allergens?: string[]
  variants?: VariantOption[]
  addonGroups?: AddonGroup[]
}

interface Props {
  item: MenuItemDetail
  onClose: () => void
  onAddToCart: (payload: {
    menuItemId: string
    name: string
    price: number
    basePrice: number
    quantity: number
    variantId?: string
    variantName?: string
    addons?: { id: string; name: string; price: number }[]
    notes?: string
  }) => void
}

export default function ItemDetailSheet({ item, onClose, onAddToCart }: Props) {
  const hasVariants = (item.variants?.length ?? 0) > 0
  const hasAddons = (item.addonGroups?.length ?? 0) > 0

  const [selectedVariant, setSelectedVariant] = useState<VariantOption | null>(
    hasVariants ? (item.variants![0] ?? null) : null
  )
  // addonSelections: groupId -> Set of selected addon IDs
  const [addonSelections, setAddonSelections] = useState<Map<string, Set<string>>>(
    () => new Map((item.addonGroups ?? []).map((g) => [g.id, new Set<string>()]))
  )
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState("")

  const basePrice = selectedVariant ? selectedVariant.price : item.price

  const addonsTotal = (item.addonGroups ?? []).reduce((sum, group) => {
    const selected = addonSelections.get(group.id) ?? new Set()
    const groupTotal = group.addons
      .filter((a) => selected.has(a.id))
      .reduce((s, a) => s + a.price, 0)
    return sum + groupTotal
  }, 0)

  const unitPrice = basePrice + addonsTotal
  const lineTotal = unitPrice * quantity

  function toggleAddon(group: AddonGroup, addonId: string) {
    setAddonSelections((prev) => {
      const next = new Map(prev)
      const selected = new Set(next.get(group.id) ?? [])
      if (selected.has(addonId)) {
        selected.delete(addonId)
      } else {
        if (group.maxSelect === 1) {
          selected.clear()
        } else if (selected.size >= group.maxSelect) {
          return prev // at max, ignore
        }
        selected.add(addonId)
      }
      next.set(group.id, selected)
      return next
    })
  }

  function validate(): string | null {
    for (const group of item.addonGroups ?? []) {
      const selected = addonSelections.get(group.id) ?? new Set()
      if (group.isRequired && selected.size < group.minSelect) {
        return `Please select at least ${group.minSelect} option${group.minSelect > 1 ? "s" : ""} for ${group.name}`
      }
    }
    return null
  }

  function handleAdd() {
    const err = validate()
    if (err) { alert(err); return }

    const selectedAddons = (item.addonGroups ?? []).flatMap((group) => {
      const selected = addonSelections.get(group.id) ?? new Set()
      return group.addons
        .filter((a) => selected.has(a.id))
        .map((a) => ({ id: a.id, name: a.name, price: a.price }))
    })

    onAddToCart({
      menuItemId: item.id,
      name: item.name,
      price: unitPrice,
      basePrice,
      quantity,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name,
      addons: selectedAddons.length > 0 ? selectedAddons : undefined,
      notes: notes.trim() || undefined,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className={`shrink-0 w-3 h-3 rounded-sm border-2 ${
                  item.isVeg ? "border-green-600 bg-green-600" : "border-red-500 bg-red-500"
                }`}
              />
              <h3 className="text-base font-bold text-gray-900 leading-tight">{item.name}</h3>
            </div>
            {item.description && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.description}</p>
            )}
            {item.allergens && item.allergens.length > 0 && (
              <p className="text-xs text-red-500 mt-1">Contains: {item.allergens.join(", ")}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">

          {/* Item image */}
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-40 object-cover rounded-xl"
            />
          )}

          {/* Variants */}
          {hasVariants && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Size / Variant <span className="text-red-500">*</span>
              </p>
              <div className="space-y-2">
                {item.variants!.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                      selectedVariant?.id === v.id
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-gray-200 text-gray-700 hover:border-orange-300"
                    }`}
                  >
                    <span className="font-medium">{v.name}</span>
                    <span className="font-bold">₹{v.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Addon groups */}
          {(item.addonGroups ?? []).map((group) => {
            const selected = addonSelections.get(group.id) ?? new Set()
            const isRadio = group.maxSelect === 1
            return (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-semibold text-gray-700">{group.name}</p>
                  {group.isRequired && (
                    <span className="text-xs bg-red-100 text-red-600 font-medium px-1.5 py-0.5 rounded-full">
                      Required
                    </span>
                  )}
                  {!group.isRequired && (
                    <span className="text-xs bg-gray-100 text-gray-500 font-medium px-1.5 py-0.5 rounded-full">
                      Optional
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    {isRadio ? "Pick 1" : `Pick up to ${group.maxSelect}`}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.addons.map((addon) => {
                    const isSelected = selected.has(addon.id)
                    return (
                      <button
                        key={addon.id}
                        onClick={() => toggleAddon(group, addon.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                          isSelected
                            ? "border-orange-500 bg-orange-50"
                            : "border-gray-200 hover:border-orange-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? "border-orange-500 bg-orange-500"
                                : "border-gray-300"
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                                <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          <span className={`font-medium ${isSelected ? "text-orange-700" : "text-gray-700"}`}>
                            {addon.name}
                          </span>
                        </div>
                        {addon.price > 0 && (
                          <span className={`font-semibold ${isSelected ? "text-orange-600" : "text-gray-500"}`}>
                            +₹{addon.price.toFixed(2)}
                          </span>
                        )}
                        {addon.price === 0 && (
                          <span className="text-xs text-green-600 font-medium">Free</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Special instructions */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Special Instructions</p>
            <textarea
              rows={2}
              placeholder="e.g. No onions, extra spicy…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>
        </div>

        {/* Footer: qty + add */}
        <div className="px-4 py-4 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-3 py-2">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm"
                aria-label="Decrease"
              >
                <Minus className="w-3.5 h-3.5 text-gray-600" />
              </button>
              <span className="text-base font-bold text-gray-900 w-5 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center shadow-sm"
                aria-label="Increase"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <button
              onClick={handleAdd}
              className="flex-1 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] transition-all text-white rounded-xl py-3 font-bold text-sm flex items-center justify-between px-4 shadow-md"
            >
              <span>Add to Cart</span>
              <span>₹{lineTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
