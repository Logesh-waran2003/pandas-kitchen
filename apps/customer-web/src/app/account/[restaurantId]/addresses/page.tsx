"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, Plus, MapPin, Star, Trash2, X, Check } from "lucide-react"
import { toast } from "sonner"

interface Address {
  id: string
  label: string
  address: string
  isDefault: boolean
  lat?: number | null
  lng?: number | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"

function getCustomerToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("pk-customer-auth")
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state?.token ?? parsed?.token ?? null
  } catch { return null }
}

async function addressFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getCustomerToken()
  if (!token) throw new Error("Not logged in")
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers as Record<string, string> ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? "Request failed")
  }
  return res.json()
}

export default function AddressesPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>()
  const router = useRouter()

  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [label, setLabel] = useState("Home")
  const [addressText, setAddressText] = useState("")
  const [isDefault, setIsDefault] = useState(false)

  useEffect(() => {
    const token = getCustomerToken()
    if (!token) {
      router.replace(`/account/${restaurantId}`)
      return
    }
    load()
  }, [restaurantId])

  async function load() {
    setLoading(true)
    try {
      const data = await addressFetch<Address[]>("/customers/me/addresses")
      setAddresses(data)
    } catch (e) {
      if ((e as Error).message === "Not logged in") {
        router.replace(`/account/${restaurantId}`)
      } else {
        toast.error("Failed to load addresses")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    if (!addressText.trim()) { toast.error("Address is required"); return }
    setSaving(true)
    try {
      const added = await addressFetch<Address>("/customers/me/addresses", {
        method: "POST",
        body: JSON.stringify({ label: label.trim() || "Home", address: addressText.trim(), isDefault }),
      })
      if (isDefault) {
        setAddresses((prev) => [added, ...prev.map((a) => ({ ...a, isDefault: false }))])
      } else {
        setAddresses((prev) => [...prev, added])
      }
      toast.success("Address saved")
      setShowForm(false)
      setLabel("Home")
      setAddressText("")
      setIsDefault(false)
    } catch (e) {
      toast.error((e as Error).message ?? "Failed to save address")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await addressFetch(`/customers/me/addresses/${id}`, { method: "DELETE" })
      setAddresses((prev) => prev.filter((a) => a.id !== id))
      toast.success("Address removed")
    } catch {
      toast.error("Failed to remove address")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Saved Addresses</h1>
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : addresses.length === 0 && !showForm ? (
          <div className="py-16 text-center">
            <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No saved addresses yet</p>
          </div>
        ) : (
          addresses.map((addr) => (
            <div
              key={addr.id}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-gray-900 text-sm">{addr.label}</p>
                    {addr.isDefault && (
                      <span className="text-xs bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="w-2.5 h-2.5" /> Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 leading-snug">{addr.address}</p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(addr.id)}
                disabled={deleting === addr.id}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                aria-label="Delete address"
              >
                {deleting === addr.id
                  ? <span className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))
        )}

        {/* Add address form */}
        {showForm ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-gray-900 text-sm">New Address</p>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Label (e.g. Home, Work)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <textarea
                rows={3}
                placeholder="Full address…"
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm text-gray-700">Set as default address</span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={saving || !addressText.trim()}
                  className="flex-1 bg-orange-500 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {saving
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Check className="w-4 h-4" />}
                  Save Address
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-orange-200 text-orange-500 rounded-2xl py-4 text-sm font-semibold hover:bg-orange-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New Address
          </button>
        )}
      </div>
    </div>
  )
}
