"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, MapPin, Plus, Trash2, Check, Star } from "lucide-react"
import { toast } from "sonner"
import { useCustomerAuthStore } from "@/stores/customer-auth.store"
import { customerApiFetch } from "@/lib/customer-api"

interface SavedAddress {
  id: string
  label: string
  address: string
  isDefault: boolean
}

export default function AddressesPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>()
  const router = useRouter()
  const { token, isLoggedIn } = useCustomerAuthStore()

  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [labelInput, setLabelInput] = useState("Home")
  const [addressInput, setAddressInput] = useState("")
  const [isDefaultInput, setIsDefaultInput] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(`/account/${restaurantId}`)
      return
    }
    fetchAddresses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchAddresses() {
    if (!token) return
    setLoading(true)
    try {
      const data = await customerApiFetch<SavedAddress[]>("/customers/me/addresses", token)
      setAddresses(data)
    } catch {
      toast.error("Could not load addresses")
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !addressInput.trim()) return
    setSaving(true)
    try {
      const created = await customerApiFetch<SavedAddress>(
        "/customers/me/addresses",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            label: labelInput.trim() || "Home",
            address: addressInput.trim(),
            isDefault: isDefaultInput,
          }),
        }
      )
      setAddresses((prev) => {
        const base = isDefaultInput ? prev.map((a) => ({ ...a, isDefault: false })) : prev
        return [...base, created]
      })
      toast.success("Address saved!")
      resetForm()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save address")
    } finally {
      setSaving(false)
    }
  }

  async function handleSetDefault(id: string) {
    if (!token) return
    try {
      await customerApiFetch<SavedAddress>(
        `/customers/me/addresses/${id}`,
        token,
        { method: "PATCH", body: JSON.stringify({ isDefault: true }) }
      )
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })))
      toast.success("Default address updated")
    } catch {
      toast.error("Could not update address")
    }
  }

  async function handleDelete(id: string) {
    if (!token) return
    setDeletingId(id)
    try {
      await customerApiFetch<void>(`/customers/me/addresses/${id}`, token, { method: "DELETE" })
      setAddresses((prev) => prev.filter((a) => a.id !== id))
      toast.success("Address removed")
    } catch {
      toast.error("Could not delete address")
    } finally {
      setDeletingId(null)
    }
  }

  function resetForm() {
    setLabelInput("Home")
    setAddressInput("")
    setIsDefaultInput(false)
    setShowForm(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Saved Addresses</h1>
      </div>

      <div className="px-4 py-5 space-y-4">
        {loading && (
          <div className="flex justify-center py-12">
            <span className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && addresses.length === 0 && !showForm && (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500 mb-1">No saved addresses</p>
            <p className="text-xs text-gray-400">Add an address for faster checkout</p>
          </div>
        )}

        {!loading && addresses.map((addr) => (
          <div key={addr.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900">{addr.label}</span>
                  {addr.isDefault && (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">
                      <Star className="w-3 h-3" />
                      Default
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 leading-snug">{addr.address}</p>
              </div>
              <button
                onClick={() => handleDelete(addr.id)}
                disabled={deletingId === addr.id}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0"
                aria-label={`Delete ${addr.label}`}
              >
                {deletingId === addr.id
                  ? <span className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5 text-red-400" />
                }
              </button>
            </div>
            {!addr.isDefault && (
              <button
                onClick={() => handleSetDefault(addr.id)}
                className="mt-3 text-xs text-orange-600 font-semibold hover:text-orange-700 transition-colors flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Set as default
              </button>
            )}
          </div>
        ))}

        {showForm && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">New Address</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <input
                type="text"
                placeholder="Label (e.g. Home, Work)"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <textarea
                rows={3}
                placeholder="Full address…"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isDefaultInput}
                  onChange={(e) => setIsDefaultInput(e.target.checked)}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm text-gray-600">Set as default address</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving || !addressInput.trim()}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {saving ? "Saving…" : "Save Address"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {!showForm && !loading && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-orange-200 text-orange-600 rounded-2xl py-3.5 font-semibold text-sm hover:bg-orange-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New Address
          </button>
        )}
      </div>
    </div>
  )
}
