"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useCartStore } from "@/stores/cart.store"
import { apiFetch } from "@/lib/api"

interface TableInfo {
  id: string
  tableNumber: string
  branchId: string
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  themeColor: string
}

export default function TableLandingPage() {
  const { tableId } = useParams<{ tableId: string }>()
  const router = useRouter()
  const setTable = useCartStore((s) => s.setTable)
  const [info, setInfo] = useState<TableInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<TableInfo>(`/tables/${tableId}/public`)
      .then((data) => {
        setTable(data.id, data.branchId, data.restaurantId)
        setInfo(data)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Table not found"))
      .finally(() => setLoading(false))
  }, [tableId, setTable])

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🐼</div>
          <p className="text-gray-500 text-sm">Loading your table…</p>
        </div>
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Table not found</h2>
          <p className="text-gray-500 text-sm">Ask your waiter for a new QR code.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6">
      {/* Hero card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg overflow-hidden">
        {/* Orange header band */}
        <div className="bg-orange-500 px-6 py-10 text-center">
          <div className="text-6xl mb-3">🐼</div>
          <h1 className="text-2xl font-extrabold text-white leading-tight">
            Welcome to<br />{info.restaurantName}
          </h1>
        </div>

        {/* Table info */}
        <div className="px-6 py-6 text-center">
          <p className="text-sm text-gray-500 mb-1">You are seated at</p>
          <p className="text-4xl font-black text-gray-900 mb-1">Table {info.tableNumber}</p>
          <p className="text-xs text-gray-400 mb-6">Scan to order · Pay at your table</p>

          <button
            onClick={() =>
              router.push(
                `/menu/${info.restaurantId}?tableId=${tableId}&branchId=${info.branchId}`
              )
            }
            className="w-full bg-orange-500 hover:bg-orange-600 active:scale-95 transition-transform text-white font-bold rounded-2xl py-4 text-base shadow-md"
          >
            View Menu &amp; Order
          </button>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">Powered by Pandas Kitchen</p>
    </div>
  )
}
