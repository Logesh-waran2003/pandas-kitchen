"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  const [slug, setSlug] = useState("")

  function handleOnlineOrder(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = slug.trim()
    if (!trimmed) return
    router.push(`/r/${trimmed}`)
  }

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-6">
      <div className="text-center w-full max-w-xs">
        <div className="text-6xl mb-4">🐼</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pandas Kitchen</h1>
        <p className="text-gray-500 mb-6">Scan the QR code at your table to order</p>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-300" />
          <span className="text-gray-400 text-sm">or</span>
          <div className="flex-1 h-px bg-gray-300" />
        </div>

        <form onSubmit={handleOnlineOrder} className="flex gap-2">
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Restaurant slug"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            type="submit"
            disabled={!slug.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-4 py-2.5 text-sm disabled:opacity-50 transition-colors"
          >
            Order Online
          </button>
        </form>
      </div>
    </div>
  )
}
