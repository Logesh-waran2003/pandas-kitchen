"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { useCartStore } from "@/stores/cart.store"
import { ShoppingBag, Truck } from "lucide-react"

interface Branch {
  id: string
  name: string
}

interface OnlineSettings {
  deliveryEnabled: boolean
  takeawayEnabled: boolean
  onlineOrderingEnabled: boolean
}

interface RestaurantPublicInfo {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  themeColor: string | null
  isActive: boolean
  branches: Branch[]
  onlineSettings: OnlineSettings | null
}

export default function RestaurantLandingPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const { setOnlineContext, setOrderType } = useCartStore((s) => ({
    setOnlineContext: s.setOnlineContext,
    setOrderType: s.setOrderType,
  }))

  const [info, setInfo] = useState<RestaurantPublicInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<RestaurantPublicInfo>(`/settings/restaurant/${slug}/public`)
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : "Restaurant not found"))
      .finally(() => setLoading(false))
  }, [slug])

  function handleOrder(type: "TAKEAWAY" | "DELIVERY") {
    if (!info || !info.branches[0]) return
    setOnlineContext(info.branches[0].id, info.id)
    setOrderType(type)
    router.push(`/menu/${info.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🐼</div>
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Restaurant not found</h2>
          <p className="text-gray-500 text-sm">Check the link and try again.</p>
        </div>
      </div>
    )
  }

  const deliveryEnabled = info.onlineSettings?.deliveryEnabled ?? false

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-orange-500 px-6 py-10 text-center">
          {info.logoUrl ? (
            <img
              src={info.logoUrl}
              alt={info.name}
              className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-4 border-white/30"
            />
          ) : (
            <div className="text-6xl mb-3">🐼</div>
          )}
          <h1 className="text-2xl font-extrabold text-white leading-tight">{info.name}</h1>
          <p className="text-orange-100 text-sm mt-1">Online Ordering</p>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {/* Status badge */}
          <div className="flex justify-center mb-6">
            {info.isActive ? (
              <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-green-200">
                <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                Open now
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200">
                <span className="w-2 h-2 bg-red-400 rounded-full inline-block" />
                Currently closed
              </span>
            )}
          </div>

          {info.isActive ? (
            <div className="space-y-3">
              <button
                onClick={() => handleOrder("TAKEAWAY")}
                className="w-full flex items-center justify-center gap-2.5 bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white font-bold rounded-2xl py-4 text-base shadow-md"
              >
                <ShoppingBag className="w-5 h-5" />
                Order for Takeaway
              </button>

              {deliveryEnabled && (
                <button
                  onClick={() => handleOrder("DELIVERY")}
                  className="w-full flex items-center justify-center gap-2.5 bg-blue-500 hover:bg-blue-600 active:scale-95 transition-all text-white font-bold rounded-2xl py-4 text-base shadow-md"
                >
                  <Truck className="w-5 h-5" />
                  Order for Delivery
                </button>
              )}
            </div>
          ) : (
            <p className="text-center text-gray-500 text-sm py-2">
              We're currently closed. Please check back later.
            </p>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">Powered by Pandas Kitchen</p>
    </div>
  )
}
