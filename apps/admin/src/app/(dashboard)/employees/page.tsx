"use client"

import { useEffect, useState, useCallback } from "react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import { Plus, Pencil, UserX, UserCheck, X, Users } from "lucide-react"
import { useAuthStore } from "@/stores/auth.store"

type UserRole =
  | "RESTAURANT_OWNER"
  | "BRANCH_MANAGER"
  | "CAPTAIN"
  | "CASHIER"
  | "KITCHEN_STAFF"
  | "SUPER_ADMIN"

interface Branch {
  id: string
  name: string
}

interface Employee {
  id: string
  name: string
  email: string
  phone?: string
  role: UserRole
  branchId?: string
  restaurantId: string
  isActive: boolean
  createdAt: string
  branch?: { id: string; name: string } | null
}

// ─── Role badge colors ────────────────────────────────────────────────────────

const ROLE_BADGE: Record<UserRole, string> = {
  RESTAURANT_OWNER: "bg-purple-100 text-purple-700",
  BRANCH_MANAGER: "bg-blue-100 text-blue-700",
  CAPTAIN: "bg-green-100 text-green-700",
  CASHIER: "bg-yellow-100 text-yellow-700",
  KITCHEN_STAFF: "bg-orange-100 text-orange-700",
  SUPER_ADMIN: "bg-gray-100 text-gray-700",
}

const ROLE_LABELS: Record<UserRole, string> = {
  RESTAURANT_OWNER: "Owner",
  BRANCH_MANAGER: "Branch Manager",
  CAPTAIN: "Captain",
  CASHIER: "Cashier",
  KITCHEN_STAFF: "Kitchen Staff",
  SUPER_ADMIN: "Super Admin",
}

const STAFF_ROLES: UserRole[] = ["CAPTAIN", "CASHIER", "KITCHEN_STAFF", "BRANCH_MANAGER"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
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

// ─── Add Staff Modal ──────────────────────────────────────────────────────────

function AddStaffModal({
  restaurantId,
  branches,
  onClose,
  onSaved,
}: {
  restaurantId: string
  branches: Branch[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("CAPTAIN")
  const [branchId, setBranchId] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiFetch("/employees", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          restaurantId,
          branchId: branchId || undefined,
        }),
      })
      toast.success("Staff member added")
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add staff")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add Staff Member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder="Min 8 characters"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={inputCls}
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={inputCls}
          >
            <option value="">— No specific branch —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
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
            {saving ? "Adding…" : "Add Staff"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Edit Staff Modal ─────────────────────────────────────────────────────────

function EditStaffModal({
  employee,
  branches,
  onClose,
  onSaved,
}: {
  employee: Employee
  branches: Branch[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(employee.name)
  const [role, setRole] = useState<UserRole>(employee.role)
  const [branchId, setBranchId] = useState(employee.branchId ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiFetch(`/employees/${employee.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          role,
          branchId: branchId || undefined,
        }),
      })
      toast.success("Staff updated")
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit Staff Member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={inputCls}
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={inputCls}
          >
            <option value="">— No specific branch —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
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
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ""

  const [employees, setEmployees] = useState<Employee[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAdd, setShowAdd] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadEmployees = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Employee[]>(`/employees?restaurantId=${restaurantId}`)
      setEmployees(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff")
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId) return
    loadEmployees()
    // Load branches for selects
    apiFetch<Branch[]>(`/settings/branches?restaurantId=${restaurantId}`)
      .then(setBranches)
      .catch(() => {
        // branches may not be available — silently ignore
      })
  }, [restaurantId, loadEmployees])

  async function toggleActive(emp: Employee) {
    if (emp.isActive) {
      if (!window.confirm(`Deactivate "${emp.name}"? They won't be able to log in.`)) return
    }
    setTogglingId(emp.id)
    try {
      if (emp.isActive) {
        await apiFetch(`/employees/${emp.id}`, { method: "DELETE" })
        toast.success("Staff deactivated")
      } else {
        await apiFetch(`/employees/${emp.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: true }),
        })
        toast.success("Staff reactivated")
      }
      loadEmployees()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update")
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Add Staff
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-5 flex items-center justify-between">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={loadEmployees}
            className="text-sm font-medium text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!error && (
        <>
          {loading ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Name", "Email", "Role", "Branch", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Users className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium text-gray-500">No staff members yet</p>
              <button
                onClick={() => setShowAdd(true)}
                className="mt-3 flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-2 rounded-lg"
              >
                <Plus className="w-4 h-4" /> Add Staff
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Branch</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{emp.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{emp.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            ROLE_BADGE[emp.role] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {ROLE_LABELS[emp.role] ?? emp.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {emp.branch?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {emp.isActive ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingEmployee(emp)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleActive(emp)}
                            disabled={togglingId === emp.id}
                            className={`p-1.5 rounded disabled:opacity-50 ${
                              emp.isActive
                                ? "hover:bg-red-50 text-red-400"
                                : "hover:bg-green-50 text-green-500"
                            }`}
                            title={emp.isActive ? "Deactivate" : "Reactivate"}
                          >
                            {emp.isActive ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add modal */}
      {showAdd && (
        <AddStaffModal
          restaurantId={restaurantId}
          branches={branches}
          onClose={() => setShowAdd(false)}
          onSaved={loadEmployees}
        />
      )}

      {/* Edit modal */}
      {editingEmployee && (
        <EditStaffModal
          employee={editingEmployee}
          branches={branches}
          onClose={() => setEditingEmployee(null)}
          onSaved={loadEmployees}
        />
      )}
    </div>
  )
}
