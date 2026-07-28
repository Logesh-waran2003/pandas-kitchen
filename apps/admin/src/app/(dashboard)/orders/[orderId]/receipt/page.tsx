"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { Printer } from "lucide-react"

interface ReceiptItem {
  id: string
  menuItemId: string
  quantity: number
  unitPrice: number
  totalPrice: number
  variantName?: string | null
  notes?: string | null
}

interface ReceiptPayment {
  id: string
  method: string
  amount: number
}

interface Receipt {
  id: string
  orderNumber: string
  status: string
  orderType: string
  subtotal: number
  tax: number
  discount: number
  serviceCharge: number
  gstRate: number
  gstAmount: number
  total: number
  createdAt: string
  notes?: string | null
  items: ReceiptItem[]
  payments: ReceiptPayment[]
  restaurant: { name: string } | null
  branch: { name: string } | null
  customer: { name: string; phone: string } | null
  table: { tableNumber: string } | null
}

function fmt(n: number) {
  return `₹${n.toFixed(2)}`
}

function fmtDate(d: string) {
  const dt = new Date(d)
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

export default function ReceiptPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<Receipt>(`/orders/${orderId}/receipt`)
      .then(setReceipt)
      .catch(e => setError(e instanceof Error ? e.message : "Failed to load receipt"))
  }, [orderId])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 print:bg-white">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    )
  }

  if (!receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 print:bg-white">
        <div className="text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading receipt…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      {/* Print button — hidden when printing */}
      <div className="flex justify-center mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow"
        >
          <Printer className="w-4 h-4" />
          Print Receipt
        </button>
      </div>

      {/* Receipt */}
      <div
        id="receipt"
        className="
          mx-auto bg-white shadow-md
          w-[320px] print:w-full print:max-w-[80mm]
          px-6 py-5 text-[13px] text-gray-800
          font-mono
        "
      >
        {/* Restaurant header */}
        <div className="text-center mb-3">
          <p className="text-base font-bold tracking-wide uppercase">{receipt.restaurant?.name ?? "Restaurant"}</p>
          {receipt.branch && (
            <p className="text-xs text-gray-500 mt-0.5">{receipt.branch.name}</p>
          )}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Order meta */}
        <div className="space-y-0.5 text-xs text-gray-600">
          {receipt.table && <div className="flex justify-between"><span>Table</span><span>{receipt.table.tableNumber}</span></div>}
          <div className="flex justify-between"><span>Order #</span><span>{receipt.orderNumber}</span></div>
          <div className="flex justify-between"><span>Type</span><span>{receipt.orderType.replace("_", "-")}</span></div>
          <div className="flex justify-between"><span>Date</span><span>{fmtDate(receipt.createdAt)}</span></div>
          {receipt.customer && (
            <div className="flex justify-between"><span>Customer</span><span>{receipt.customer.name}</span></div>
          )}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Items */}
        <div className="space-y-1.5">
          {receipt.items.map(item => (
            <div key={item.id}>
              <div className="flex justify-between">
                <span className="flex-1 pr-2">
                  {item.quantity}× {item.variantName ? `(${item.variantName})` : ""}
                </span>
                <span>{fmt(item.totalPrice)}</span>
              </div>
              {item.notes && (
                <p className="text-xs text-gray-400 pl-4">Note: {item.notes}</p>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Totals */}
        <div className="space-y-0.5 text-xs">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmt(receipt.subtotal)}</span></div>
          {receipt.discount > 0 && (
            <div className="flex justify-between text-red-500"><span>Discount</span><span>-{fmt(receipt.discount)}</span></div>
          )}
          {receipt.serviceCharge > 0 && (
            <div className="flex justify-between text-gray-600"><span>Service Charge</span><span>{fmt(receipt.serviceCharge)}</span></div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>GST ({receipt.gstRate}%)</span>
            <span>{fmt(receipt.gstAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-base text-gray-900 pt-1 border-t border-gray-300 mt-1">
            <span>TOTAL</span>
            <span>{fmt(receipt.total)}</span>
          </div>
        </div>

        {/* Payments */}
        {receipt.payments.length > 0 && (
          <>
            <div className="border-t border-dashed border-gray-400 my-2" />
            <div className="space-y-0.5 text-xs">
              <p className="text-gray-500 uppercase tracking-wide font-semibold mb-1">Payment</p>
              {receipt.payments.map(p => (
                <div key={p.id} className="flex justify-between text-gray-700">
                  <span>{p.method}</span>
                  <span>{fmt(p.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {receipt.notes && (
          <>
            <div className="border-t border-dashed border-gray-400 my-2" />
            <p className="text-xs text-gray-500 italic">"{receipt.notes}"</p>
          </>
        )}

        <div className="border-t border-dashed border-gray-400 my-3" />

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 space-y-0.5">
          <p className="font-semibold">Thank you! Visit again 🙏</p>
          <p>Powered by Pandas Kitchen</p>
        </div>
      </div>
    </div>
  )
}
