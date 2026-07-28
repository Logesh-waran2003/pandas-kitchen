"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import {
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
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
interface PnL {
  date: string
  revenue: number
  tax: number
  discount: number
  netRevenue: number
  orderCount: number
  byMode: Record<string, number>
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  PREPARING: "#f97316",
  READY: "#22c55e",
  SERVED: "#14b8a6",
  PAID: "#6b7280",
  CANCELLED: "#ef4444",
}

function SectionSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
      <div className="bg-gray-100 rounded" style={{ height }} />
    </div>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border border-red-200 bg-red-50 rounded-xl p-5 flex items-center justify-between">
      <p className="text-red-600 text-sm">{message}</p>
      <button onClick={onRetry} className="text-sm font-medium text-red-600 hover:text-red-800 underline">
        Retry
      </button>
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

  const [pnlDate, setPnlDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [pnl, setPnl] = useState<PnL | null>(null)
  const [pnlLoading, setPnlLoading] = useState(false)
  const [pnlError, setPnlError] = useState<string | null>(null)

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

  async function loadPnL(date: string) {
    setPnlLoading(true); setPnlError(null)
    try { setPnl(await apiFetch<PnL>(`/analytics/daily-pnl?date=${date}`)) }
    catch (e) { setPnlError(e instanceof Error ? e.message : "Failed") }
    finally { setPnlLoading(false) }
  }

  useEffect(() => {
    loadSummary()
    loadRevenue()
    loadPopular()
    loadStatus()
    loadPnL(pnlDate)
  }, [])

  useEffect(() => { loadPnL(pnlDate) }, [pnlDate])

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

      {/* Daily P&L Widget */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Daily P&amp;L</h2>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={pnlDate}
              onChange={(e) => setPnlDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              onClick={() => loadPnL(pnlDate)}
              className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
        {pnlError ? (
          <ErrorCard message={pnlError} onRetry={() => loadPnL(pnlDate)} />
        ) : pnlLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-20" />
            ))}
          </div>
        ) : pnl ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-orange-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(pnl.revenue)}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Net Revenue (ex-tax)</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(pnl.netRevenue)}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Orders</p>
                <p className="text-xl font-bold text-blue-600">{pnl.orderCount}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Discount Given</p>
                <p className="text-xl font-bold text-red-500">{formatCurrency(pnl.discount)}</p>
              </div>
            </div>
            {Object.keys(pnl.byMode).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment Breakdown</p>
                <div className="space-y-1.5">
                  {Object.entries(pnl.byMode).map(([mode, amount]) => (
                    <div key={mode} className="flex justify-between text-sm">
                      <span className="text-gray-600">{mode}</span>
                      <span className="font-semibold text-gray-800">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Daily Revenue Area Chart */}
      {revError ? (
        <ErrorCard message={revError} onRetry={loadRevenue} />
      ) : revLoading ? (
        <SectionSkeleton />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Daily Revenue (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit" })
                }
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]}
                labelFormatter={(label) =>
                  new Date(label as string).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                }
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Charts row — Pie + Popular table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Status — Donut chart */}
        {statusError ? (
          <ErrorCard message={statusError} onRetry={loadStatus} />
        ) : statusLoading ? (
          <SectionSkeleton height={260} />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Orders by Status</h2>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {statusData.map(({ status }, i) => (
                    <Cell key={i} fill={STATUS_COLORS[status] ?? "#9ca3af"} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [value, name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Popular Items — table */}
        {popError ? (
          <ErrorCard message={popError} onRetry={loadPopular} />
        ) : popLoading ? (
          <SectionSkeleton height={260} />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Popular Items</h2>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-xs font-medium text-gray-400 w-8">#</th>
                    <th className="text-left py-2 text-xs font-medium text-gray-400">Item</th>
                    <th className="text-right py-2 text-xs font-medium text-gray-400">Qty Sold</th>
                    <th className="text-right py-2 text-xs font-medium text-gray-400">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {popular.slice(0, 10).map((item, i) => (
                    <tr key={item.name} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="py-2.5 font-medium text-gray-800">{item.name}</td>
                      <td className="py-2.5 text-right text-gray-600">{item.totalQuantity}</td>
                      <td className="py-2.5 text-right text-gray-700 font-medium">
                        {formatCurrency(item.totalRevenue)}
                      </td>
                    </tr>
                  ))}
                  {popular.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-gray-400 text-sm">
                        No data yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
