"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts"

interface Summary {
  totalRevenue: number
  totalOrders: number
  totalTables: number
  totalCustomers: number
  todayRevenue: number
  todayOrders: number
}
interface RevenuePoint { date: string; revenue: number }
interface PopularItem { name: string; totalQuantity: number; totalRevenue: number }
interface StatusCount { status: string; count: number }

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#eab308",
  CONFIRMED: "#3b82f6",
  PREPARING: "#f97316",
  READY: "#22c55e",
  SERVED: "#14b8a6",
  PAID: "#9ca3af",
  CANCELLED: "#ef4444",
}

function SectionSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
      <div className={`bg-gray-100 rounded`} style={{ height }} />
    </div>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border border-red-200 bg-red-50 rounded-xl p-5 flex items-center justify-between">
      <p className="text-red-600 text-sm">{message}</p>
      <button onClick={onRetry} className="text-sm font-medium text-red-600 hover:text-red-800 underline">Retry</button>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [revenue, setRevenue] = useState<RevenuePoint[]>([])
  const [popular, setPopular] = useState<PopularItem[]>([])
  const [statusData, setStatusData] = useState<StatusCount[]>([])

  const [sumLoading, setSumLoading] = useState(true)
  const [revLoading, setRevLoading] = useState(true)
  const [popLoading, setPopLoading] = useState(true)
  const [statusLoading, setStatusLoading] = useState(true)

  const [sumError, setSumError] = useState<string | null>(null)
  const [revError, setRevError] = useState<string | null>(null)
  const [popError, setPopError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  async function loadSummary() {
    setSumLoading(true); setSumError(null)
    try { setSummary(await apiFetch<Summary>("/analytics/summary")) }
    catch (e) { setSumError(e instanceof Error ? e.message : "Failed") }
    finally { setSumLoading(false) }
  }

  async function loadRevenue() {
    setRevLoading(true); setRevError(null)
    try { setRevenue(await apiFetch<RevenuePoint[]>("/analytics/revenue")) }
    catch (e) { setRevError(e instanceof Error ? e.message : "Failed") }
    finally { setRevLoading(false) }
  }

  async function loadPopular() {
    setPopLoading(true); setPopError(null)
    try { setPopular(await apiFetch<PopularItem[]>("/analytics/popular-items")) }
    catch (e) { setPopError(e instanceof Error ? e.message : "Failed") }
    finally { setPopLoading(false) }
  }

  async function loadStatus() {
    setStatusLoading(true); setStatusError(null)
    try { setStatusData(await apiFetch<StatusCount[]>("/analytics/orders-by-status")) }
    catch (e) { setStatusError(e instanceof Error ? e.message : "Failed") }
    finally { setStatusLoading(false) }
  }

  useEffect(() => {
    loadSummary()
    loadRevenue()
    loadPopular()
    loadStatus()
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
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      {/* Summary cards */}
      {sumError ? (
        <ErrorCard message={sumError} onRetry={loadSummary} />
      ) : sumLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((s) => <StatCard key={s.label} {...s} />)}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue line chart */}
        {revError ? (
          <ErrorCard message={revError} onRetry={loadRevenue} />
        ) : revLoading ? (
          <SectionSkeleton />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Daily Revenue (30 days)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                  labelFormatter={(label) => new Date(label as string).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Popular items bar chart */}
        {popError ? (
          <ErrorCard message={popError} onRetry={loadPopular} />
        ) : popLoading ? (
          <SectionSkeleton />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Top 10 Items by Orders</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={popular.slice(0, 10)}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  width={75}
                />
                <Tooltip
                  formatter={(value: number) => [value, "Orders"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Bar dataKey="totalQuantity" radius={[0, 4, 4, 0]}>
                  {popular.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill="#f97316" opacity={1 - i * 0.07} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Orders by status */}
      {statusError ? (
        <ErrorCard message={statusError} onRetry={loadStatus} />
      ) : statusLoading ? (
        <SectionSkeleton height={120} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Orders by Status</h2>
          <div className="space-y-3">
            {statusData.map(({ status, count }) => {
              const max = Math.max(...statusData.map((s) => s.count), 1)
              const pct = Math.round((count / max) * 100)
              const color = STATUS_COLORS[status] ?? "#9ca3af"
              return (
                <div key={status} className="flex items-center gap-3">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 w-24 text-center"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    {status}
                  </span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-8 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
