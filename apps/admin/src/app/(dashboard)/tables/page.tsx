"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Table as TableIcon } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";

interface Branch {
  id: string;
  name: string;
  isActive: boolean;
}

interface RestaurantTable {
  id: string;
  tableNumber: string;
  capacity: number;
  status: TableStatus;
  branchId: string;
}

interface ModalState {
  open: boolean;
  table: RestaurantTable | null;
}

const STATUS_STYLES: Record<TableStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  OCCUPIED: "bg-red-100 text-red-700",
  RESERVED: "bg-amber-100 text-amber-700",
  CLEANING: "bg-blue-100 text-blue-700",
};

const STATUS_OPTIONS: TableStatus[] = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-24 mb-3" />
      <div className="h-4 bg-gray-200 rounded w-20 mb-4" />
      <div className="h-6 bg-gray-200 rounded w-24 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-full mb-3" />
      <div className="flex gap-2 mt-2">
        <div className="h-8 w-8 bg-gray-200 rounded" />
        <div className="h-8 w-8 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

interface TableModalProps {
  modal: ModalState;
  selectedBranchId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function TableModal({ modal, selectedBranchId, onClose, onSuccess }: TableModalProps) {
  const [tableNumber, setTableNumber] = useState<string>(
    modal.table ? String(modal.table.tableNumber) : ""
  );
  const [capacity, setCapacity] = useState<string>(
    modal.table ? String(modal.table.capacity) : "4"
  );
  const [status, setStatus] = useState<TableStatus>(
    modal.table ? modal.table.status : "AVAILABLE"
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (modal.table) {
        await apiFetch(`/tables/${modal.table.id}`, {
          method: "PATCH",
          body: JSON.stringify({ tableNumber: tableNumber, capacity: Number(capacity), status }),
        });
        toast.success("Table updated");
      } else {
        await apiFetch("/tables", {
          method: "POST",
          body: JSON.stringify({
            tableNumber: tableNumber,
            capacity: Number(capacity),
            status,
            branchId: selectedBranchId,
          }),
        });
        toast.success("Table added");
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white max-w-md w-full mx-4 rounded-xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {modal.table ? "Edit Table" : "Add Table"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Table Number
            </label>
            <input
              type="text"
              required
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g. T-01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacity
            </label>
            <input
              type="number"
              required
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g. 4"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TableStatus)}
              className="border border-gray-200 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-60"
            >
              {submitting ? "Saving..." : modal.table ? "Save Changes" : "Add Table"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface TableCardProps {
  table: RestaurantTable;
  onEdit: (table: RestaurantTable) => void;
  onDelete: (table: RestaurantTable) => void;
  onStatusChange: (table: RestaurantTable, status: TableStatus) => void;
}

function TableCard({ table, onEdit, onDelete, onStatusChange }: TableCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col gap-3">
      <div>
        <p className="text-4xl font-bold text-gray-900">{table.tableNumber}</p>
        <p className="text-sm text-gray-500 mt-1">👤 {table.capacity} seats</p>
      </div>

      <div className="flex flex-col gap-2">
        <span
          className={`self-start text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[table.status]}`}
        >
          {table.status}
        </span>
        <select
          value={table.status}
          onChange={(e) => onStatusChange(table, e.target.value as TableStatus)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-gray-700"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onEdit(table)}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Edit table"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => onDelete(table)}
          className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Delete table"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default function TablesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ open: false, table: null });

  useEffect(() => {
    async function loadBranches() {
      try {
        const data = await apiFetch<Branch[]>("/settings/branches");
        setBranches(data);
        const firstActive = data.find((b) => b.isActive);
        if (firstActive) setSelectedBranchId(firstActive.id);
      } catch {
        toast.error("Failed to load branches");
      }
    }
    loadBranches();
  }, []);

  async function fetchTables(branchId: string) {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<RestaurantTable[]>(`/tables?branchId=${branchId}`);
      setTables(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load tables");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedBranchId) fetchTables(selectedBranchId);
  }, [selectedBranchId]);

  async function handleStatusChange(table: RestaurantTable, status: TableStatus) {
    try {
      await apiFetch(`/tables/${table.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success("Status updated");
      fetchTables(selectedBranchId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handleDelete(table: RestaurantTable) {
    if (!window.confirm("Delete this table?")) return;
    try {
      await apiFetch(`/tables/${table.id}`, { method: "DELETE" });
      toast.success("Table deleted");
      fetchTables(selectedBranchId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete table");
    }
  }

  function openAdd() {
    setModal({ open: true, table: null });
  }

  function openEdit(table: RestaurantTable) {
    setModal({ open: true, table });
  }

  function closeModal() {
    setModal({ open: false, table: null });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tables</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage seating and table status</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 min-w-40"
            >
              {branches.length === 0 && (
                <option value="">No branches</option>
              )}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <button
              onClick={openAdd}
              disabled={!selectedBranchId}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              Add Table
            </button>
          </div>
        </div>

        {error && (
          <div className="border border-red-200 bg-red-50 rounded-xl p-4 mb-6 flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => fetchTables(selectedBranchId)}
              className="text-sm text-red-700 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {!loading && !error && tables.length === 0 && selectedBranchId && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <TableIcon size={48} className="text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg font-medium">No tables found</p>
            <p className="text-gray-400 text-sm mt-1 mb-6">Add your first table to get started</p>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Add Table
            </button>
          </div>
        )}

        {!loading && !error && !selectedBranchId && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <TableIcon size={48} className="text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg font-medium">Select a branch to view tables</p>
          </div>
        )}

        {!loading && !error && tables.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                onEdit={openEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      {modal.open && (
        <TableModal
          modal={modal}
          selectedBranchId={selectedBranchId}
          onClose={closeModal}
          onSuccess={() => fetchTables(selectedBranchId)}
        />
      )}
    </div>
  );
}
