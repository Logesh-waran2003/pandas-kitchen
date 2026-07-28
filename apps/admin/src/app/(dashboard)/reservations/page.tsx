"use client"

import { useEffect, useState, useCallback } from "react"
import { apiFetch } from "@/lib/api"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { Plus, X, CalendarDays, Clock, Users, Phone } from "lucide-react"

type ReservationStatus = "UPCOMING" | "SEATED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"

interface Branch { id: string; name: string }
interface TableOption { id: string; tableNumber: string }
interface Reservation {
  id: string
  customerName: string
  phone: string
  partySize: number
  date: string
  notes?: string
  status: ReservationStatus
  branchId: string
  tableId?: string
  table?: { id: string; tableNumber: string } | null
  branch?: { id: string; name: string }
}

const STATUS_BADGE: Record<ReservationStatus, string> = {
  UPCOMING: "bg-blue-100 text-blue-700",
  SEATED: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
  NO_SHOW: "bg-orange-100 text-orange-700",
}

const STATUS_TABS: (ReservationStatus | "ALL")[] = ["ALL", "UPCOMING", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"]

function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[status]}`}>
      {status.replace("_", " ")}
    </span>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

function AddReservationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [tables, setTables] = useState<TableOption[]>([])
  const [branchId, setBranchId] = useState("")
  const [tableId, setTableId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [phone, setPhone] = useState("")
  const [partySize, setPartySize] = useState(2)
  const [date, setDate] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch<Branch[]>("/settings/branches").then((data) => {
      setBranches(data)
      if (data.length > 0) setBranchId(data[0].id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!branchId) return
    setTableId("")
    apiFetch<TableOption[]>(`/tables?branchId=${branchId}`).then(setTables).catch(() => {})
  }, [branchId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) { toast.error("Pick a date and time"); return }
    setSaving(true)
    try {
      await apiFetch("/reservations", {
        method: "POST",
        body: JSON.stringify({
          restaurantId: "", // resolved server-side from JWT
          branchId,
          tableId: tableId || undefined,
          customerName,
          phone,
          partySize,
          date,
          notes: notes || undefined,
        }),
      })
      toast.success("Reservation created")
      onCreated()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create reservation")
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"

  return (
    <Modal title="Add Reservation" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch <span className="text-red-500">*</span></label>
            <select required value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input required type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputCls} placeholder="Guest name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
            <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+91 …" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Party size <span className="text-red-500">*</span></label>
            <input required type="number" min={1} value={partySize} onChange={(e) => setPartySize(parseInt(e.target.value) || 1)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date & time <span className="text-red-500">*</span></label>
            <input required type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Table (optional)</label>
            <select value={tableId} onChange={(e) => setTableId(e.target.value)} className={inputCls}>
              <option value="">— Assign later —</option>
              {tables.map((t) => <option key={t.id} value={t.id}>{t.tableNumber}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none`} placeholder="Allergies, occasion, special requests…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-60">
            {saving ? "Saving…" : "Add Reservation"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ReservationCard({ reservation, onAction }: { reservation: Reservation; onAction: () => void }) {
  const [loading, setLoading] = useState(false)

  async function updateStatus(status: ReservationStatus) {
    setLoading(true)
    try {
      await apiFetch(`/reservations/${reservation.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      toast.success(`Marked as ${status.toLowerCase().replace("_", " ")}`)
      onAction()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this reservation?")) return
    setLoading(true)
    try {
      await apiFetch(`/reservations/${reservation.id}`, { method: "DELETE" })
      toast.success("Reservation deleted")
      onAction()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setLoading(false)
    }
  }

  const reservationDate = new Date(reservation.date)
  const timeStr = reservationDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{reservation.customerName}</p>
          <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
            <Phone className="w-3 h-3" />
            <span>{reservation.phone}</span>
          </div>
        </div>
        <StatusBadge status={reservation.status} />
      </div>

      <div className="flex flex-wrap gap-3 text-sm text-gray-600">
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-400" />{timeStr}</span>
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-gray-400" />{reservation.partySize} guests</span>
        {reservation.table && (
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
            Table {reservation.table.tableNumber}
          </span>
        )}
      </div>

      {reservation.notes && (
        <p className="text-xs text-gray-400 italic">"{reservation.notes}"</p>
      )}

      {reservation.status === "UPCOMING" && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => updateStatus("SEATED")}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-60"
          >
            Seat Now
          </button>
          <button
            onClick={() => updateStatus("NO_SHOW")}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium border border-orange-200 text-orange-600 hover:bg-orange-50 rounded-lg disabled:opacity-60"
          >
            No Show
          </button>
          <button
            onClick={() => updateStatus("CANCELLED")}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      )}
      {reservation.status === "SEATED" && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => updateStatus("COMPLETED")}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium bg-gray-500 hover:bg-gray-600 text-white rounded-lg disabled:opacity-60"
          >
            Mark Completed
          </button>
        </div>
      )}
      {["COMPLETED", "CANCELLED", "NO_SHOW"].includes(reservation.status) && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ReservationStatus | "ALL">("UPCOMING")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ date })
      if (activeTab !== "ALL") params.set("status", activeTab)
      const data = await apiFetch<Reservation[]>(`/reservations?${params}`)
      setReservations(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reservations")
    } finally {
      setLoading(false)
    }
  }, [date, activeTab])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reservations</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Add Reservation
        </button>
      </div>

      {/* Date selector + tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? "bg-orange-500 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="border border-red-200 bg-red-50 rounded-xl p-5 flex items-center justify-between">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={load} className="text-sm font-medium text-red-600 hover:text-red-800 underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse space-y-3">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-40 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : reservations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <CalendarDays className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-medium">No reservations for this date</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-3 flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-2 rounded-lg"
          >
            <Plus className="w-4 h-4" /> Add First Reservation
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reservations.map((r) => (
            <ReservationCard key={r.id} reservation={r} onAction={load} />
          ))}
        </div>
      )}

      {showAdd && <AddReservationModal onClose={() => setShowAdd(false)} onCreated={load} />}
    </div>
  )
}
