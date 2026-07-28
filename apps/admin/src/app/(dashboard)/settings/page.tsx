"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import { Plus, Pencil, X, Users, Building2, Store, Shield, Trash2, ChefHat } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Restaurant { id?: string; name: string; themeColor: string; logoUrl?: string }
interface Branch { id: string; name: string; isActive: boolean }
interface Department { id: string; name: string; branchId: string }
type StaffRole = "RESTAURANT_OWNER" | "BRANCH_MANAGER" | "CASHIER" | "CAPTAIN" | "KITCHEN_STAFF"
interface StaffMember { id: string; name: string; email: string; role: StaffRole; branchId?: string; branchName?: string; isActive: boolean }

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<StaffRole, string> = {
  RESTAURANT_OWNER: "bg-purple-100 text-purple-700",
  BRANCH_MANAGER: "bg-blue-100 text-blue-700",
  CASHIER: "bg-green-100 text-green-700",
  CAPTAIN: "bg-orange-100 text-orange-700",
  KITCHEN_STAFF: "bg-gray-100 text-gray-600",
}

const ROLES: StaffRole[] = [
  "RESTAURANT_OWNER", "BRANCH_MANAGER", "CASHIER", "CAPTAIN", "KITCHEN_STAFF",
]

// ─── Shared UI ────────────────────────────────────────────────────────────────

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"

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

function RoleBadge({ role }: { role: StaffRole }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[role]}`}>
      {role.replace(/_/g, " ")}
    </span>
  )
}

// ─── Tab 1: Restaurant Profile ────────────────────────────────────────────────

function RestaurantTab() {
  const [data, setData] = useState<Restaurant>({ name: "", themeColor: "#f97316" })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<Restaurant>("/settings/restaurant")
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiFetch("/settings/restaurant", {
        method: "PATCH",
        body: JSON.stringify(data),
      })
      toast.success("Restaurant profile saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 max-w-md">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-10 bg-gray-100 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-xl p-5 flex items-center justify-between max-w-md">
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={load} className="text-sm text-red-600 underline">Retry</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Restaurant Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={data.name}
          onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Theme Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={data.themeColor}
            onChange={(e) => setData((d) => ({ ...d, themeColor: e.target.value }))}
            className="h-10 w-16 border border-gray-200 rounded-lg cursor-pointer p-1"
          />
          <span className="text-sm text-gray-500">{data.themeColor}</span>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
        <input
          type="text"
          value={data.logoUrl ?? ""}
          onChange={(e) => setData((d) => ({ ...d, logoUrl: e.target.value }))}
          className={inputCls}
          placeholder="https://…"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="mt-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </form>
  )
}

// ─── Tab 2: Branches ──────────────────────────────────────────────────────────

function BranchModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Branch | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(editing?.name ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await apiFetch(`/settings/branches/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name }),
        })
        toast.success("Branch updated")
      } else {
        await apiFetch("/settings/branches", {
          method: "POST",
          body: JSON.stringify({ name }),
        })
        toast.success("Branch added")
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={editing ? "Edit Branch" : "Add Branch"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Branch Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-60">
            {saving ? "Saving…" : editing ? "Save" : "Add Branch"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function BranchesTab() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<false | Branch | null>(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setBranches(await apiFetch<Branch[]>("/settings/branches"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function toggleActive(branch: Branch) {
    setTogglingId(branch.id)
    try {
      await apiFetch(`/settings/branches/${branch.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !branch.isActive }),
      })
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{branches.length} branch{branches.length !== 1 ? "es" : ""}</p>
        <button
          onClick={() => setModal(null)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Add Branch
        </button>
      </div>

      {error ? (
        <div className="border border-red-200 bg-red-50 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={load} className="text-sm text-red-600 underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-gray-400">
          <Building2 className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">No branches yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Active</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-gray-900">{branch.name}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(branch)}
                      disabled={togglingId === branch.id}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                        branch.isActive ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${branch.isActive ? "translate-x-4" : "translate-x-1"}`} />
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setModal(branch)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== false && (
        <BranchModal editing={modal} onClose={() => setModal(false)} onSaved={load} />
      )}
    </div>
  )
}

// ─── Tab 3: Staff ─────────────────────────────────────────────────────────────

function StaffModal({
  editing,
  branches,
  onClose,
  onSaved,
}: {
  editing: StaffMember | null
  branches: Branch[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(editing?.name ?? "")
  const [email, setEmail] = useState(editing?.email ?? "")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<StaffRole>(editing?.role ?? "CASHIER")
  const [branchId, setBranchId] = useState(editing?.branchId ?? "")
  const [isActive, setIsActive] = useState(editing?.isActive ?? true)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await apiFetch(`/settings/staff/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, role, branchId: branchId || undefined, isActive }),
        })
        toast.success("Staff member updated")
      } else {
        await apiFetch("/settings/staff", {
          method: "POST",
          body: JSON.stringify({ name, email, password, role, branchId: branchId || undefined }),
        })
        toast.success("Staff member added")
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={editing ? "Edit Staff" : "Add Staff"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        {!editing && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
          <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={inputCls}>
            {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
            <option value="">— No specific branch —</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        {editing && (
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-orange-500" />
            Active
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-60">
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Staff"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function StaffTab({ branches }: { branches: Branch[] }) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<false | StaffMember | null>(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setStaff(await apiFetch<StaffMember[]>("/settings/staff"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function deactivate(member: StaffMember) {
    try {
      await apiFetch(`/settings/staff/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      })
      toast.success(`${member.name} deactivated`)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{staff.length} staff member{staff.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setModal(null)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {error ? (
        <div className="border border-red-200 bg-red-50 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={load} className="text-sm text-red-600 underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
        </div>
      ) : staff.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-gray-400">
          <Users className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">No staff members yet</p>
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
              {staff.map((member) => (
                <tr key={member.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-gray-900">{member.name}</td>
                  <td className="px-4 py-3 text-gray-600">{member.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={member.role} /></td>
                  <td className="px-4 py-3 text-gray-600">{member.branchName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${member.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {member.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setModal(member)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {member.isActive && (
                        <button
                          onClick={() => deactivate(member)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== false && (
        <StaffModal editing={modal} branches={branches} onClose={() => setModal(false)} onSaved={load} />
      )}
    </div>
  )
}

// ─── Tab 4: Security ─────────────────────────────────────────────────────────

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    setSaving(true)
    try {
      await apiFetch("/auth/change-password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      toast.success("Password changed successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to change password")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Current Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputCls}
          autoComplete="current-password"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          New Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputCls}
          autoComplete="new-password"
        />
        <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Confirm New Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputCls}
          autoComplete="new-password"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="mt-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
      >
        {saving ? "Saving…" : "Change Password"}
      </button>
    </form>
  )
}

// ─── Tab 5: Kitchen Sections ─────────────────────────────────────────────────

function KitchenSectionsTab({ branches }: { branches: Branch[] }) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<false | Department | null>(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setDepartments(await apiFetch<Department[]>("/kitchen/departments"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(dept: Department) {
    if (!window.confirm(`Delete section "${dept.name}"? This cannot be undone.`)) return
    try {
      await apiFetch(`/kitchen/departments/${dept.id}`, { method: "DELETE" })
      toast.success("Section deleted")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{departments.length} section{departments.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setModal(null)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Add Section
        </button>
      </div>

      {error ? (
        <div className="border border-red-200 bg-red-50 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={load} className="text-sm text-red-600 underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-gray-400">
          <ChefHat className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">No kitchen sections yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Section</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Branch</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr key={dept.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-gray-900">{dept.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {branches.find((b) => b.id === dept.branchId)?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setModal(dept)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(dept)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== false && (
        <DepartmentModal
          editing={modal}
          branches={branches}
          onClose={() => setModal(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}

function DepartmentModal({
  editing,
  branches,
  onClose,
  onSaved,
}: {
  editing: Department | null
  branches: Branch[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(editing?.name ?? "")
  const [branchId, setBranchId] = useState(editing?.branchId ?? branches[0]?.id ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await apiFetch(`/kitchen/departments/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name }),
        })
        toast.success("Section updated")
      } else {
        await apiFetch("/kitchen/departments", {
          method: "POST",
          body: JSON.stringify({ name, branchId }),
        })
        toast.success("Section added")
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={editing ? "Edit Section" : "Add Kitchen Section"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Section Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grill, Bakery, Cold Kitchen"
            className={inputCls}
          />
        </div>
        {!editing && (
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
              <option value="">— Select branch —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-60">
            {saving ? "Saving…" : editing ? "Save" : "Add Section"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "profile" | "branches" | "staff" | "security" | "kitchen"

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Restaurant Profile", icon: Store },
  { id: "branches", label: "Branches", icon: Building2 },
  { id: "staff", label: "Staff", icon: Users },
  { id: "security", label: "Security", icon: Shield },
  { id: "kitchen", label: "Kitchen Sections", icon: ChefHat },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile")
  const [branches, setBranches] = useState<Branch[]>([])

  useEffect(() => {
    apiFetch<Branch[]>("/settings/branches").then(setBranches).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "profile" && <RestaurantTab />}
        {activeTab === "branches" && <BranchesTab />}
        {activeTab === "staff" && <StaffTab branches={branches} />}
        {activeTab === "security" && <SecurityTab />}
        {activeTab === "kitchen" && <KitchenSectionsTab branches={branches} />}
      </div>
    </div>
  )
}
