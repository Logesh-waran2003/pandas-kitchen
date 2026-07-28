"use client"

import { useEffect, useState, useCallback } from "react"
import { apiFetch } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { Clock, X, CheckCircle2 } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch {
  id: string
  name: string
}

interface ShiftUser {
  id: string
  name: string
}

interface Shift {
  id: string
  branchId: string
  status: "OPEN" | "CLOSED"
  openingFloat: number
  closingFloat: number | null
  openedAt: string
  closedAt: string | null
  notes: string | null
  openedBy: ShiftUser
  closedBy: ShiftUser | null
}

interface CloseResult {
  id: string
  status: string
  summary: {
    totalCollected: number
    cashCollected: number
    otherCollected: number
    openingFloat: number
    closingFloat: number | null
    cashVariance: number | null
    transactionCount: number
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function duration(from: string, to?: string | null) {
  const ms = new Date(to ?? new Date()).getTime() - new Date(from).getTime()
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ─── Modal shell ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Open Shift Modal ─────────────────────────────────────────────────────────

function OpenShiftModal({
  branches,
  onClose,
  onOpened,
}: {
  branches: Branch[]
  onClose: () => void
  onOpened: () => void
}) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "")
  const [openingFloat, setOpeningFloat] = useState("0")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiFetch("/shifts/open", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          openingFloat: parseFloat(openingFloat) || 0,
          notes: notes || undefined,
        }),
      })
      toast.success("Shift opened")
      onOpened()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open shift")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Open Shift" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Branch <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={inputCls}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Opening Float (₹)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…"
            className={inputCls + " resize-none"}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-60"
          >
            {saving ? "Opening…" : "Open Shift"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Close Shift Modal ────────────────────────────────────────────────────────

function CloseShiftModal({
  shift,
  onClose,
  onClosed,
}: {
  shift: Shift
  onClose: () => void
  onClosed: (result: CloseResult) => void
}) {
  const [closingFloat, setClosingFloat] = useState("")
  const [notes, setNotes] = useState(shift.notes ?? "")
  const [saving, setSaving] = useState(false)

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const result = await apiFetch<CloseResult>(`/shifts/${shift.id}/close`, {
        method: "PATCH",
        body: JSON.stringify({
          closingFloat: closingFloat !== "" ? parseFloat(closingFloat) : undefined,
          notes: notes || undefined,
        }),
      })
      toast.success("Shift closed")
      onClosed(result)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close shift")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Close Shift" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Shift info */}
        <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Started at</span>
            <span className="font-medium text-gray-800">{formatTime(shift.openedAt)} · {formatDate(shift.openedAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Duration so far</span>
            <span className="font-medium text-gray-800">{duration(shift.openedAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Opening float</span>
            <span className="font-medium text-gray-800">{formatCurrency(shift.openingFloat)}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Closing Float — physical cash counted (₹)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={closingFloat}
            onChange={(e) => setClosingFloat(e.target.value)}
            placeholder="Leave blank to skip reconciliation"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…"
            className={inputCls + " resize-none"}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-60"
          >
            {saving ? "Closing…" : "Close Shift"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Close Summary Card ───────────────────────────────────────────────────────

function CloseSummaryCard({ result, onDismiss }: { result: CloseResult; onDismiss: () => void }) {
  const { summary } = result
  const variance = summary.cashVariance

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <h2 className="text-sm font-semibold text-gray-800">Shift Closed — Summary</h2>
        </div>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-center">
          <p className="text-xs text-gray-500 mb-0.5">Total Collected</p>
          <p className="text-sm font-bold text-gray-900">{formatCurrency(summary.totalCollected)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-center">
          <p className="text-xs text-gray-500 mb-0.5">Cash</p>
          <p className="text-sm font-bold text-gray-900">{formatCurrency(summary.cashCollected)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-center">
          <p className="text-xs text-gray-500 mb-0.5">Other (card/UPI)</p>
          <p className="text-sm font-bold text-gray-900">{formatCurrency(summary.otherCollected)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-center">
          <p className="text-xs text-gray-500 mb-0.5">Transactions</p>
          <p className="text-sm font-bold text-gray-900">{summary.transactionCount}</p>
        </div>
      </div>
      {variance != null && (
        <div
          className={`mt-3 rounded-lg px-4 py-2.5 text-sm font-medium ${
            variance === 0
              ? "bg-green-50 text-green-700"
              : variance < 0
              ? "bg-red-50 text-red-700"
              : "bg-yellow-50 text-yellow-700"
          }`}
        >
          Cash variance: {variance > 0 ? "+" : ""}{formatCurrency(variance)}
          {variance === 0 && " — perfect match"}
          {variance < 0 && " — cash short"}
          {variance > 0 && " — cash over"}
        </div>
      )}
    </div>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-gray-100 animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState("")
  const [branchesLoading, setBranchesLoading] = useState(true)

  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [activeLoading, setActiveLoading] = useState(false)

  const [shifts, setShifts] = useState<Shift[]>([])
  const [shiftsLoading, setShiftsLoading] = useState(false)

  const [showOpen, setShowOpen] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [closeResult, setCloseResult] = useState<CloseResult | null>(null)

  // Load branches on mount
  useEffect(() => {
    apiFetch<Branch[]>("/settings/branches")
      .then((data) => {
        setBranches(data)
        if (data.length > 0) setSelectedBranchId(data[0].id)
      })
      .catch(() => toast.error("Failed to load branches"))
      .finally(() => setBranchesLoading(false))
  }, [])

  const loadActive = useCallback(async () => {
    if (!selectedBranchId) return
    setActiveLoading(true)
    try {
      const data = await apiFetch<Shift | null>(`/shifts/active?branchId=${selectedBranchId}`)
      setActiveShift(data)
    } catch {
      setActiveShift(null)
    } finally {
      setActiveLoading(false)
    }
  }, [selectedBranchId])

  const loadShifts = useCallback(async () => {
    if (!selectedBranchId) return
    setShiftsLoading(true)
    try {
      const data = await apiFetch<Shift[]>(`/shifts?branchId=${selectedBranchId}`)
      setShifts(data)
    } catch {
      toast.error("Failed to load shift history")
    } finally {
      setShiftsLoading(false)
    }
  }, [selectedBranchId])

  useEffect(() => {
    loadActive()
    loadShifts()
  }, [loadActive, loadShifts])

  function handleShiftChange() {
    loadActive()
    loadShifts()
    setCloseResult(null)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Shifts</h1>
        {!branchesLoading && branches.length > 1 && (
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Active Shift Banner */}
      {activeLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse h-16" />
      ) : activeShift ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <div className="text-sm">
              <span className="font-semibold text-green-800">Shift Open</span>
              <span className="text-green-700">
                {" "}— started at {formatTime(activeShift.openedAt)} by {activeShift.openedBy.name}
                {" "}· {duration(activeShift.openedAt)} elapsed
                {" "}· Float: {formatCurrency(activeShift.openingFloat)}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowClose(true)}
            className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium shrink-0"
          >
            Close Shift
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">No shift open for this branch</span>
          </div>
          <button
            onClick={() => setShowOpen(true)}
            disabled={!selectedBranchId}
            className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50 shrink-0"
          >
            Open Shift
          </button>
        </div>
      )}

      {/* Close summary */}
      {closeResult && (
        <CloseSummaryCard result={closeResult} onDismiss={() => setCloseResult(null)} />
      )}

      {/* Shift History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Shift History</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Opened By</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Opened At</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Closed By</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Closed At</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Duration</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Opening Float</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {shiftsLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
            ) : shifts.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-400 text-sm">No shifts recorded yet</p>
                </td>
              </tr>
            ) : (
              shifts.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-700">{formatDate(s.openedAt)}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{s.openedBy.name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatTime(s.openedAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{s.closedBy?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.closedAt ? formatTime(s.closedAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.closedAt ? duration(s.openedAt, s.closedAt) : duration(s.openedAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(s.openingFloat)}
                  </td>
                  <td className="px-5 py-3">
                    {s.status === "OPEN" ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        OPEN
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        CLOSED
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showOpen && branches.length > 0 && (
        <OpenShiftModal
          branches={branches}
          onClose={() => setShowOpen(false)}
          onOpened={handleShiftChange}
        />
      )}
      {showClose && activeShift && (
        <CloseShiftModal
          shift={activeShift}
          onClose={() => setShowClose(false)}
          onClosed={(result) => {
            setCloseResult(result)
            handleShiftChange()
          }}
        />
      )}
    </div>
  )
}
