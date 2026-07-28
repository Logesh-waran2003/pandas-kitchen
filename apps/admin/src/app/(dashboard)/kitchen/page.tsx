"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { apiFetch } from "@/lib/api"
import { timeElapsed } from "@/lib/utils"
import { toast } from "sonner"
import { RefreshCw, ChefHat, Check } from "lucide-react"
import { getSocket } from "@/lib/socket"
import { useAuthStore } from "@/stores/auth.store"

interface Branch { id: string; name: string }
interface KotItem { id: string; name: string; quantity: number; status: "PENDING" | "IN_PROGRESS" | "DONE" }
interface Kot {
  id: string
  ticketNumber: string
  orderNumber: string
  tableName?: string
  department?: string
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED"
  createdAt: string
  items: KotItem[]
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonKotCard() {
  return (
    <div className="animate-pulse bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="h-4 bg-gray-200 rounded w-20" />
        <div className="h-3 bg-gray-100 rounded w-12" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-16" />
      <div className="space-y-1.5">
        <div className="h-7 bg-gray-100 rounded w-full" />
        <div className="h-7 bg-gray-100 rounded w-4/5" />
      </div>
      <div className="h-8 bg-gray-200 rounded-lg w-full" />
    </div>
  )
}

// ─── Live Timer ───────────────────────────────────────────────────────────────

function LiveTimer({ createdAt }: { createdAt: string }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="text-xs text-gray-400">{timeElapsed(createdAt)}</span>
}

// ─── KOT Card ────────────────────────────────────────────────────────────────

function KotCard({ kot, onUpdated }: { kot: Kot; onUpdated: () => void }) {
  const [actionLoading, setActionLoading] = useState(false)
  const [markingItemId, setMarkingItemId] = useState<string | null>(null)

  const isNew = Date.now() - new Date(kot.createdAt).getTime() < 60_000

  async function handleStatusChange(status: "IN_PROGRESS" | "COMPLETED") {
    setActionLoading(true)
    try {
      await apiFetch(`/kitchen/kot/${kot.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      toast.success(status === "IN_PROGRESS" ? "Started cooking" : "Marked complete")
      onUpdated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update")
    } finally {
      setActionLoading(false)
    }
  }

  async function markItemDone(itemId: string) {
    setMarkingItemId(itemId)
    try {
      await apiFetch(`/kitchen/kot/items/${itemId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "DONE" }),
      })
      onUpdated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update item")
    } finally {
      setMarkingItemId(null)
    }
  }

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm p-3 space-y-2 ${
        isNew
          ? "animate-pulse border-orange-400 ring-2 ring-orange-400"
          : "border-gray-200"
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900 text-sm">#{kot.ticketNumber}</span>
            <span className="text-xs text-gray-500">Order #{kot.orderNumber}</span>
          </div>
          {kot.tableName && (
            <span className="text-xs text-gray-500">Table: {kot.tableName}</span>
          )}
          {kot.department && (
            <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
              {kot.department}
            </span>
          )}
        </div>
        <LiveTimer createdAt={kot.createdAt} />
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        {kot.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-2 py-1.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full shrink-0">
                ×{item.quantity}
              </span>
              <span className="text-sm text-gray-800 truncate">{item.name}</span>
            </div>
            {item.status === "DONE" ? (
              <Check className="w-4 h-4 text-green-500 shrink-0" />
            ) : (
              <button
                onClick={() => markItemDone(item.id)}
                disabled={markingItemId === item.id}
                className="text-xs border border-gray-200 rounded px-2 py-0.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50 shrink-0"
              >
                {markingItemId === item.id ? "…" : "Mark Done"}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Action button */}
      {kot.status === "PENDING" && (
        <button
          onClick={() => handleStatusChange("IN_PROGRESS")}
          disabled={actionLoading}
          className="w-full py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-60"
        >
          {actionLoading ? "…" : "Start Cooking"}
        </button>
      )}
      {kot.status === "IN_PROGRESS" && (
        <button
          onClick={() => handleStatusChange("COMPLETED")}
          disabled={actionLoading}
          className="w-full py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60"
        >
          {actionLoading ? "…" : "Mark Complete"}
        </button>
      )}
      {kot.status === "COMPLETED" && (
        <div className="flex items-center justify-center gap-1.5 py-1 text-green-600 text-sm font-medium">
          <Check className="w-4 h-4" />
          Done
        </div>
      )}
    </div>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

const COLUMN_CONFIG = {
  PENDING: {
    label: "Pending",
    headerCls: "bg-yellow-50 border-yellow-200",
    badgeCls: "bg-yellow-100 text-yellow-700",
  },
  IN_PROGRESS: {
    label: "In Progress",
    headerCls: "bg-blue-50 border-blue-200",
    badgeCls: "bg-blue-100 text-blue-700",
  },
  COMPLETED: {
    label: "Completed",
    headerCls: "bg-green-50 border-green-200",
    badgeCls: "bg-green-100 text-green-700",
  },
} as const

function KanbanColumn({
  status,
  kots,
  loading,
  onUpdated,
}: {
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED"
  kots: Kot[]
  loading: boolean
  onUpdated: () => void
}) {
  const cfg = COLUMN_CONFIG[status]
  return (
    <div className="flex flex-col bg-gray-50 rounded-xl border border-gray-200 overflow-hidden min-h-0">
      {/* Column header */}
      <div className={`flex items-center justify-between px-3 py-2.5 border-b ${cfg.headerCls}`}>
        <span className="font-semibold text-gray-800 text-sm">{cfg.label}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badgeCls}`}>
          {loading ? "—" : kots.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <>
            <SkeletonKotCard />
            <SkeletonKotCard />
          </>
        ) : kots.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
            No tickets
          </div>
        ) : (
          kots.map((kot) => (
            <KotCard key={kot.id} kot={kot} onUpdated={onUpdated} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KitchenPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState("")
  const [kots, setKots] = useState<Kot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDept, setSelectedDept] = useState<string>("All")
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const accessToken = useAuthStore((s) => s.accessToken)

  // Load branches once on mount
  useEffect(() => {
    apiFetch<Branch[]>("/settings/branches")
      .then((data) => {
        setBranches(data)
        if (data.length > 0) setSelectedBranchId(data[0].id)
      })
      .catch(() => toast.error("Failed to load branches"))
  }, [])

  const loadKots = useCallback(async (branchId: string, showSpinner = false) => {
    if (!branchId) return
    if (showSpinner) setSpinning(true)
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Kot[]>(`/kitchen/kot?branchId=${branchId}`)
      setKots(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load KOTs")
    } finally {
      setLoading(false)
      if (showSpinner) setSpinning(false)
    }
  }, [])

  // Reload when branch changes
  useEffect(() => {
    if (selectedBranchId) loadKots(selectedBranchId)
  }, [selectedBranchId, loadKots])

  // Auto-refresh management
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (autoRefresh && selectedBranchId) {
      intervalRef.current = setInterval(() => loadKots(selectedBranchId), 30_000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, selectedBranchId, loadKots])

  // Socket.io — live KOT updates
  useEffect(() => {
    if (!accessToken || !selectedBranchId) return

    const socket = getSocket(accessToken)

    function onConnect() {
      setSocketConnected(true)
      socket.emit("join:kitchen", selectedBranchId)
    }

    function onDisconnect() {
      setSocketConnected(false)
    }

    function onKotCreated() {
      loadKots(selectedBranchId)
    }

    function onKotStatusChanged(data: { id: string; status: Kot["status"] }) {
      setKots((prev) =>
        prev.map((k) => (k.id === data.id ? { ...k, status: data.status } : k)),
      )
    }

    if (socket.connected) {
      setSocketConnected(true)
      socket.emit("join:kitchen", selectedBranchId)
    }

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("kot.created", onKotCreated)
    socket.on("kot.status_changed", onKotStatusChanged)

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("kot.created", onKotCreated)
      socket.off("kot.status_changed", onKotStatusChanged)
    }
  }, [accessToken, selectedBranchId, loadKots])

  // Unique departments from loaded KOTs
  const departments = ["All", ...Array.from(new Set(kots.map((k) => k.department).filter(Boolean) as string[]))]

  // Client-side department filter
  const filtered = selectedDept === "All"
    ? kots
    : kots.filter((k) => k.department === selectedDept)

  const byStatus = {
    PENDING: filtered.filter((k) => k.status === "PENDING"),
    IN_PROGRESS: filtered.filter((k) => k.status === "IN_PROGRESS"),
    COMPLETED: filtered.filter((k) => k.status === "COMPLETED"),
  }

  function handleRefresh() {
    loadKots(selectedBranchId, true)
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 mr-2">Kitchen Display</h1>
        {socketConnected && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live
          </span>
        )}

        {/* Branch selector */}
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        {/* Department filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                selectedDept === dept
                  ? "bg-orange-500 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-orange-500"
            />
            Auto-refresh (30s)
          </label>

          {/* Manual refresh */}
          <button
            onClick={handleRefresh}
            disabled={!selectedBranchId || loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={handleRefresh}
            className="text-sm font-medium text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state — no branch yet */}
      {!selectedBranchId && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <ChefHat className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-medium">Select a branch to view tickets</p>
        </div>
      )}

      {/* 3-column Kanban */}
      {selectedBranchId && !error && (
        <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
          <KanbanColumn status="PENDING" kots={byStatus.PENDING} loading={loading} onUpdated={handleRefresh} />
          <KanbanColumn status="IN_PROGRESS" kots={byStatus.IN_PROGRESS} loading={loading} onUpdated={handleRefresh} />
          <KanbanColumn status="COMPLETED" kots={byStatus.COMPLETED} loading={loading} onUpdated={handleRefresh} />
        </div>
      )}
    </div>
  )
}
