"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { apiFetch } from "@/lib/api"
import { timeElapsed } from "@/lib/utils"
import { toast } from "sonner"
import { RefreshCw, ChefHat, Check } from "lucide-react"
import { getSocket } from "@/lib/socket"
import { useAuthStore } from "@/stores/auth.store"

interface Branch { id: string; name: string }
interface Department { id: string; name: string }
interface KotItem {
  id: string
  name: string
  quantity: number
  status: "PENDING" | "IN_PROGRESS" | "DONE"
  notes?: string | null
  department?: { id: string; name: string }
}
interface Kot {
  id: string
  ticketNumber: string
  orderNumber: string
  tableName?: string
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED"
  createdAt: string
  items: KotItem[]
}

// ─── KDS audio alert ─────────────────────────────────────────────────────────

function playKDSAlert() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    oscillator.frequency.value = 880
    oscillator.type = "sine"
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.4)
  } catch (e) {}
}

// ─── Dept color ───────────────────────────────────────────────────────────────

function deptColor(name: string | undefined): string {
  if (!name) return "#6b7280"
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
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
  const borderColor = deptColor(kot.items[0]?.department?.name)

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
      style={{ borderLeft: `4px solid ${borderColor}` }}
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
          {kot.items[0]?.department?.name && (
            <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
              {kot.items[0].department.name}
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
              <div className="min-w-0">
                <span className="text-sm text-gray-800 truncate block">{item.name}</span>
                {item.notes && (
                  <p className="text-xs text-gray-400 italic">"{item.notes}"</p>
                )}
              </div>
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
  const [departments, setDepartments] = useState<Department[]>([])
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null)
  const [kots, setKots] = useState<Kot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeDeptRef = useRef<string | null>(null)
  const accessToken = useAuthStore((s) => s.accessToken)

  // Keep ref in sync so socket closure always sees latest dept
  activeDeptRef.current = activeDeptId

  // Load branches once on mount
  useEffect(() => {
    apiFetch<Branch[]>("/settings/branches")
      .then((data) => {
        setBranches(data)
        if (data.length > 0) setSelectedBranchId(data[0].id)
      })
      .catch(() => toast.error("Failed to load branches"))
  }, [])

  // Load departments when branch changes
  useEffect(() => {
    if (!selectedBranchId) return
    setActiveDeptId(null)
    apiFetch<Department[]>(`/kitchen/departments?branchId=${selectedBranchId}`)
      .then(setDepartments)
      .catch(() => toast.error("Failed to load departments"))
  }, [selectedBranchId])

  const loadKots = useCallback(async (branchId: string, departmentId?: string | null, showSpinner = false) => {
    if (!branchId) return
    if (showSpinner) setSpinning(true)
    setLoading(true)
    setError(null)
    try {
      const qs = departmentId
        ? `?branchId=${branchId}&departmentId=${departmentId}`
        : `?branchId=${branchId}`
      const data = await apiFetch<Kot[]>(`/kitchen/kot${qs}`)
      setKots(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load KOTs")
    } finally {
      setLoading(false)
      if (showSpinner) setSpinning(false)
    }
  }, [])

  // Reload when branch or active dept changes
  useEffect(() => {
    if (selectedBranchId) loadKots(selectedBranchId, activeDeptId)
  }, [selectedBranchId, activeDeptId, loadKots])

  // Auto-refresh management
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (autoRefresh && selectedBranchId) {
      intervalRef.current = setInterval(
        () => loadKots(selectedBranchId, activeDeptRef.current),
        30_000,
      )
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
      socket.emit("join:branch", selectedBranchId)
    }

    function onDisconnect() {
      setSocketConnected(false)
    }

    function onKotCreated(newKot: Kot) {
      playKDSAlert()
      const deptId = activeDeptRef.current
      if (deptId) {
        // Only prepend if the new KOT has at least one item in the active department
        const matches = newKot.items.some((item) => item.department?.id === deptId)
        if (!matches) return
        setKots((prev) => [newKot, ...prev])
      } else {
        setKots((prev) => [newKot, ...prev])
      }
    }

    function onKotStatusChanged(data: { id: string; status: Kot["status"] }) {
      setKots((prev) =>
        prev.map((k) => (k.id === data.id ? { ...k, status: data.status } : k)),
      )
    }

    function onWaiterCalled(data: { tableNumber: string }) {
      toast.info(`🔔 Table ${data.tableNumber} called a waiter`)
    }

    function onBillRequested(data: { tableNumber: string }) {
      toast.info(`💳 Table ${data.tableNumber} requested the bill`)
    }

    if (socket.connected) {
      setSocketConnected(true)
      socket.emit("join:kitchen", selectedBranchId)
      socket.emit("join:branch", selectedBranchId)
    }

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("kot.created", onKotCreated)
    socket.on("kot.status_changed", onKotStatusChanged)
    socket.on("waiter:called", onWaiterCalled)
    socket.on("bill:requested", onBillRequested)

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("kot.created", onKotCreated)
      socket.off("kot.status_changed", onKotStatusChanged)
      socket.off("waiter:called", onWaiterCalled)
      socket.off("bill:requested", onBillRequested)
    }
  }, [accessToken, selectedBranchId])

  const byStatus = {
    PENDING: kots.filter((k) => k.status === "PENDING"),
    IN_PROGRESS: kots.filter((k) => k.status === "IN_PROGRESS"),
    COMPLETED: kots.filter((k) => k.status === "COMPLETED"),
  }

  function handleRefresh() {
    loadKots(selectedBranchId, activeDeptId, true)
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

      {/* Department section selector */}
      {departments.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveDeptId(null)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeDeptId === null
                ? "bg-orange-500 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            All Sections
          </button>
          {departments.map((dept) => (
            <button
              key={dept.id}
              onClick={() => setActiveDeptId(dept.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeDeptId === dept.id
                  ? "text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
              style={
                activeDeptId === dept.id
                  ? { backgroundColor: deptColor(dept.name), borderColor: deptColor(dept.name) }
                  : {}
              }
            >
              {dept.name}
            </button>
          ))}
        </div>
      )}

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
