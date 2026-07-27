"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"

interface AnalyticsSummary {
  totalRevenue: number
  totalOrders: number
  totalTables: number
  totalCustomers: number
  todayRevenue: number
  todayOrders: number
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 bg-gray-200 rounded" />
        <div className="h-8 w-8 bg-gray-200 rounded" />
      </div>
      <div className="h-9 w-28 bg-gray-200 rounded mt-3" />
    </div>
  )
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<AnalyticsSummary>("/analytics/summary")
      setSummary(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const stats = summary
    ? [
        { label: "Total Revenue", value: formatCurrency(summary.totalRevenue), icon: "💰" },
        { label: "Today Revenue", value: formatCurrency(summary.todayRevenue), icon: "📈" },
        { label: "Total Orders", value: summary.totalOrders.toString(), icon: "🧾" },
        { label: "Today Orders", value: summary.todayOrders.toString(), icon: "🛒" },
        { label: "Tables", value: summary.totalTables.toString(), icon: "🪑" },
        { label: "Customers", value: summary.totalCustomers.toString(), icon: "👥" },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to Pandas Kitchen 🐼</h1>
        <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening today.</p>
      </div>

      {error ? (
        <div className="border border-red-200 bg-red-50 rounded-xl p-5 flex items-center justify-between">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={load}
            className="text-sm font-medium text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <span className="text-2xl">{stat.icon}</span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
              ))}
        </div>
      )}
    </div>
  )
}
