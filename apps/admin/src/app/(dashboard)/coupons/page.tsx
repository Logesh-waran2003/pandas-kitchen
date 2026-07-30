"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import { Plus, Tag, X, Trash2 } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Coupon {
  id: string
  code: string
  discountType: "PERCENT" | "FLAT"
  discountValue: number
  minOrderValue: number
  maxUses: number | null
  usedCount: number
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

interface CouponForm {
  code: string
  discountType: "PERCENT" | "FLAT"
  discountValue: string
  minOrderValue: string
  maxUses: string
  expiresAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"

const EMPTY_FORM: CouponForm = {
  code: "",
  discountType: "PERCENT",
  discountValue: "",
  minOrderValue: "",
  maxUses: "",
  expiresAt: "",
}

// ─── Create Coupon Modal ──────────────────────────────────────────────────────

function CreateCouponModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  function set(key: keyof CouponForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiFetch("/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.toUpperCase().trim(),
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : undefined,
          maxUses: form.maxUses ? Number(form.maxUses) : undefined,
          expiresAt: form.expiresAt || undefined,
        }),
      })
      toast.success("Coupon created")
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create coupon")
    } finally {
      setSaving(false)
    }
  }

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
          <h3 className="text-lg font-semibold text-gray-900">Create Coupon</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="SAVE20"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.discountType}
                onChange={(e) => set("discountType", e.target.value)}
                className={inputCls}
              >
                <option value="PERCENT">Percent (%)</option>
                <option value="FLAT">Flat (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                max={form.discountType === "PERCENT" ? 100 : undefined}
                step="0.01"
                value={form.discountValue}
                onChange={(e) => set("discountValue", e.target.value)}
                placeholder={form.discountType === "PERCENT" ? "20" : "50"}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min order (₹)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.minOrderValue}
                onChange={(e) => set("minOrderValue", e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max uses</label>
              <input
                type="number"
                min={1}
                step={1}
                value={form.maxUses}
                onChange={(e) => set("maxUses", e.target.value)}
                placeholder="Unlimited"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expires at</label>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => set("expiresAt", e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create Coupon"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setCoupons(await apiFetch<Coupon[]>("/coupons"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function toggleActive(coupon: Coupon) {
    setTogglingId(coupon.id)
    try {
      await apiFetch(`/coupons/${coupon.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !coupon.isActive }),
      })
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setTogglingId(null)
    }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return
    setDeletingId(coupon.id)
    try {
      await apiFetch(`/coupons/${coupon.id}`, { method: "DELETE" })
      toast.success("Coupon deleted")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setDeletingId(null)
    }
  }

  function formatExpiry(expiresAt: string | null) {
    if (!expiresAt) return "Never"
    const d = new Date(expiresAt)
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage promo codes and discounts</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Plus className="w-4 h-4" /> New Coupon
        </button>
      </div>

      {error ? (
        <div className="border border-red-200 bg-red-50 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={load} className="text-sm text-red-600 underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <Tag className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">No coupons yet</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 text-sm text-orange-500 hover:underline"
          >
            Create your first coupon
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Discount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Min Order</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Uses</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Expires</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Active</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <span className="font-mono font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs tracking-wider">
                      {coupon.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {coupon.discountType === "PERCENT"
                      ? `${coupon.discountValue}%`
                      : `₹${coupon.discountValue}`}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {coupon.minOrderValue > 0 ? `₹${coupon.minOrderValue}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {coupon.usedCount}
                    {coupon.maxUses !== null && (
                      <span className="text-gray-400"> / {coupon.maxUses}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatExpiry(coupon.expiresAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(coupon)}
                      disabled={togglingId === coupon.id}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                        coupon.isActive ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          coupon.isActive ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {coupon.usedCount === 0 && (
                      <button
                        onClick={() => deleteCoupon(coupon)}
                        disabled={deletingId === coupon.id}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-50"
                        title="Delete coupon"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateCouponModal onClose={() => setShowCreate(false)} onSaved={load} />
      )}
    </div>
  )
}
