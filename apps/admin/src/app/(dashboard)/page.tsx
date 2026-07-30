"use client"

import { useEffect, useState } from "react"
import { ShoppingBag, TrendingUp, Clock, Users } from "lucide-react"
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

interface TodayStats {
  totalOrdersToday: number
  onlineOrdersToday: number
  pendingOnlineOrders: number
  revenueToday: number
  activeTablesCount: number
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
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [summaryData, statsData] = await Promise.all([
        apiFetch<AnalyticsSummary>("/analytics/summary"),
        apiFetch<TodayStats>("/orders/stats/today"),
      ])
      setSummary(summaryData)
      setTodayStats(statsData)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
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

  const onlineCards = todayStats
    ? [
        {
          label: "Online Orders Today",
          value: todayStats.onlineOrdersToday.toString(),
          icon: ShoppingBag,
          color: "text-orange-500",
          bg: "bg-orange-50",
        },
        {
          label: "Today's Revenue",
          value: formatCurrency(todayStats.revenueToday),
          icon: TrendingUp,
          color: "text-green-600",
          bg: "bg-green-50",
        },
        {
          label: "Pending Orders",
          value: todayStats.pendingOnlineOrders.toString(),
          icon: Clock,
          color: "text-yellow-600",
          bg: "bg-yellow-50",
        },
        {
          label: "Active Tables",
          value: todayStats.activeTablesCount.toString(),
          icon: Users,
          color: "text-blue-600",
          bg: "bg-blue-50",
        },
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
        <>
          {/* Online order real-time stats */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Online Orders — Live
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                : onlineCards.map((card) => {
                    const Icon = card.icon
                    return (
                      <div
                        key={card.label}
                        className="bg-white rounded-2xl shadow-sm p-5"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs text-gray-500 font-medium">{card.label}</p>
                          <div className={`${card.bg} rounded-lg p-1.5`}>
                            <Icon className={`w-4 h-4 ${card.color}`} />
                          </div>
                        </div>
                        <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                      </div>
                    )
                  })}
            </div>
          </div>

          {/* General analytics */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Overview
            </h2>
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
          </div>
        </>
      )}
    </div>
  )
}
