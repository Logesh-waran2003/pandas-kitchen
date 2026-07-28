"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Pencil, Trash2, X, Table as TableIcon } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { getSocket, disconnectSocket } from "@/lib/socket";

type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
type TableShape = "rectangle" | "circle";

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
  posX: number;
  posY: number;
  width: number;
  height: number;
  shape: TableShape;
}

interface ModalState {
  open: boolean;
  table: RestaurantTable | null;
}

interface DragState {
  tableId: string;
  offsetX: number;
  offsetY: number;
}

const STATUS_STYLES: Record<TableStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  OCCUPIED: "bg-orange-100 text-orange-700",
  RESERVED: "bg-amber-100 text-amber-700",
  CLEANING: "bg-blue-100 text-blue-700",
};

const STATUS_BG: Record<TableStatus, string> = {
  AVAILABLE: "#22c55e",
  OCCUPIED: "#f97316",
  RESERVED: "#f59e0b",
  CLEANING: "#3b82f6",
};

const STATUS_OPTIONS: TableStatus[] = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];

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

export default function TablesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ open: false, table: null });

  const dragState = useRef<DragState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let token: string | null = null;
    try {
      const raw = localStorage.getItem("pandas-auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        token = parsed?.state?.accessToken ?? null;
      }
    } catch {
      // ignore parse errors
    }
    if (!token) return;

    const socket = getSocket(token);

    socket.on("table.status_changed", (payload: { id: string; status: TableStatus }) => {
      setTables((prev) =>
        prev.map((t) => (t.id === payload.id ? { ...t, status: payload.status } : t))
      );
    });

    return () => {
      disconnectSocket();
    };
  }, []);

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

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, table: RestaurantTable) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragState.current = {
      tableId: table.id,
      offsetX: e.clientX - rect.left - table.posX,
      offsetY: e.clientY - rect.top - table.posY,
    };
    const ghost = document.createElement("div");
    ghost.style.opacity = "0";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!dragState.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const newPosX = Math.max(0, e.clientX - rect.left - dragState.current.offsetX);
    const newPosY = Math.max(0, e.clientY - rect.top - dragState.current.offsetY);
    const tableId = dragState.current.tableId;
    dragState.current = null;

    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, posX: newPosX, posY: newPosY } : t))
    );

    try {
      await apiFetch(`/tables/${tableId}`, {
        method: "PATCH",
        body: JSON.stringify({ posX: newPosX, posY: newPosY }),
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save position");
      fetchTables(selectedBranchId);
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

  const branchTables = tables.filter((t) => t.branchId === selectedBranchId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tables</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage seating layout and table status</p>
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

        <div className="flex gap-4 h-[680px]">
          {/* Floor Plan — 60% */}
          <div className="flex-[3] flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Floor Plan</h2>
              <p className="text-xs text-gray-400">Drag tables to reposition</p>
            </div>
            <div
              ref={containerRef}
              className="relative bg-gray-100 rounded-xl border border-gray-200 overflow-hidden flex-1"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d1d5db" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 z-10">
                  <p className="text-sm text-gray-500">Loading tables...</p>
                </div>
              )}

              {!loading && branchTables.length === 0 && selectedBranchId && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <TableIcon size={40} className="text-gray-300 mb-3" />
                  <p className="text-gray-400 text-sm">No tables yet. Add one from the panel.</p>
                </div>
              )}

              {!loading && !selectedBranchId && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <TableIcon size={40} className="text-gray-300 mb-3" />
                  <p className="text-gray-400 text-sm">Select a branch to view the floor plan.</p>
                </div>
              )}

              {branchTables.map((table) => (
                <div
                  key={table.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, table)}
                  style={{
                    position: "absolute",
                    left: table.posX,
                    top: table.posY,
                    width: table.width || 80,
                    height: table.height || 80,
                    backgroundColor: STATUS_BG[table.status],
                    borderRadius: table.shape === "circle" ? "50%" : "8px",
                    cursor: "grab",
                    userSelect: "none",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    border: "2px solid rgba(255,255,255,0.4)",
                  }}
                  title={`Table ${table.tableNumber} — ${table.status}`}
                >
                  <span
                    className="font-bold text-white text-xs leading-tight text-center px-1"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
                  >
                    {table.tableNumber}
                  </span>
                  <span
                    className="text-white leading-tight text-center"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)", fontSize: "10px" }}
                  >
                    {table.capacity}p
                  </span>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {(Object.entries(STATUS_BG) as [TableStatus, string][]).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-sm inline-block"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-gray-500">{status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel — 40% */}
          <div className="flex-[2] flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700"
              >
                {branches.length === 0 && <option value="">No branches</option>}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <button
                onClick={openAdd}
                disabled={!selectedBranchId}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Plus size={15} />
                Add Table
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-5 bg-gray-200 rounded w-16" />
                      <div className="h-5 bg-gray-200 rounded w-20" />
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-12 mt-2" />
                  </div>
                ))}

              {!loading && branchTables.length === 0 && selectedBranchId && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <TableIcon size={36} className="text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm font-medium">No tables</p>
                  <p className="text-gray-400 text-xs mt-1 mb-4">Add your first table to get started</p>
                  <button
                    onClick={openAdd}
                    className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus size={14} />
                    Add Table
                  </button>
                </div>
              )}

              {!loading &&
                branchTables.map((table) => (
                  <div
                    key={table.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm">{table.tableNumber}</p>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[table.status]}`}
                          >
                            {table.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{table.capacity} seats</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(table)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          title="Edit table"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(table)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete table"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <select
                        value={table.status}
                        onChange={(e) => handleStatusChange(table, e.target.value as TableStatus)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-gray-700"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
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
