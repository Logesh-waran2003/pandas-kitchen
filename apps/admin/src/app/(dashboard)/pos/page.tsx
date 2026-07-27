"use client"

import { useEffect, useState, useCallback } from "react"
import { apiFetch } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { Plus, Minus, X, User, CreditCard, Banknote, Smartphone, Globe } from "lucide-react"

interface Category { id: string; name: string }
interface MenuItem { id: string; name: string; price: number; isVeg: boolean; isAvailable: boolean; categoryId: string }
interface Variant { id: string; name: string; price: number }
interface Branch { id: string; name: string }
interface TableOption { id: string; tableNumber: string }
interface Customer { id: string; name: string; phone: string; loyaltyPoints: number }

interface CartItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
  variantId?: string
  variantName?: string
}

type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY"
type PaymentMethod = "CASH" | "CARD" | "UPI" | "ONLINE"
type DiscountType = "FLAT" | "PERCENT"

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"

function SkeletonRow() {
  return <div className="h-9 bg-gray-100 rounded-lg animate-pulse mb-1" />
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-24 bg-gray-200" />
      <div className="p-2 space-y-1">
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
    </div>
  )
}

interface VariantModalProps {
  item: MenuItem
  variants: Variant[]
  onSelect: (item: MenuItem, variant: Variant) => void
  onClose: () => void
}

function VariantModal({ item, variants, onSelect, onClose }: VariantModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{item.name} — Select Variant</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-2">
          {variants.map(v => (
            <button
              key={v.id}
              onClick={() => { onSelect(item, v); onClose() }}
              className="w-full flex justify-between items-center px-4 py-3 border border-gray-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-colors text-sm"
            >
              <span className="font-medium text-gray-800">{v.name}</span>
              <span className="text-orange-600 font-semibold">{formatCurrency(v.price)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function POSPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [tables, setTables] = useState<TableOption[]>([])
  const [catLoading, setCatLoading] = useState(true)
  const [itemLoading, setItemLoading] = useState(true)

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedBranchId, setSelectedBranchId] = useState("")
  const [selectedTableId, setSelectedTableId] = useState("")
  const [orderType, setOrderType] = useState<OrderType>("DINE_IN")

  const [customerSearch, setCustomerSearch] = useState("")
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [customerSearching, setCustomerSearching] = useState(false)

  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<DiscountType>("FLAT")
  const [serviceChargePct, setServiceChargePct] = useState(0)
  const [gstRate, setGstRate] = useState(5)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH")
  const [submitting, setSubmitting] = useState(false)

  const [variantModal, setVariantModal] = useState<{ item: MenuItem; variants: Variant[] } | null>(null)

  useEffect(() => {
    Promise.all([
      apiFetch<Category[]>("/menu/categories"),
      apiFetch<MenuItem[]>("/menu/items"),
      apiFetch<Branch[]>("/settings/branches"),
    ]).then(([cats, itms, brs]) => {
      setCategories(cats)
      setCatLoading(false)
      setItems(itms)
      setItemLoading(false)
      setBranches(brs)
      if (brs.length > 0) setSelectedBranchId(brs[0].id)
    }).catch(() => {
      setCatLoading(false)
      setItemLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedBranchId || orderType !== "DINE_IN") { setTables([]); setSelectedTableId(""); return }
    apiFetch<TableOption[]>(`/tables?branchId=${selectedBranchId}`).then(setTables).catch(() => {})
  }, [selectedBranchId, orderType])

  const searchCustomer = useCallback(async (phone: string) => {
    if (phone.length < 7) return
    setCustomerSearching(true)
    try {
      const results = await apiFetch<Customer[]>(`/customers?search=${phone}`)
      setCustomer(results.length > 0 ? results[0] : null)
    } catch { setCustomer(null) }
    finally { setCustomerSearching(false) }
  }, [])

  async function handleItemClick(item: MenuItem) {
    try {
      const variants = await apiFetch<Variant[]>(`/menu/items/${item.id}/variants`)
      if (variants.length > 0) {
        setVariantModal({ item, variants })
      } else {
        addToCart(item)
      }
    } catch {
      addToCart(item)
    }
  }

  function addToCart(item: MenuItem, variant?: Variant) {
    const price = variant ? variant.price : item.price
    const variantId = variant?.id
    const variantName = variant?.name
    setCart(prev => {
      const key = `${item.id}-${variantId ?? ""}`
      const existing = prev.find(c => `${c.menuItemId}-${c.variantId ?? ""}` === key)
      if (existing) return prev.map(c => `${c.menuItemId}-${c.variantId ?? ""}` === key ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { menuItemId: item.id, name: item.name, price, quantity: 1, variantId, variantName }]
    })
  }

  function updateQty(idx: number, delta: number) {
    setCart(prev => {
      const updated = prev.map((c, i) => i === idx ? { ...c, quantity: c.quantity + delta } : c)
      return updated.filter(c => c.quantity > 0)
    })
  }

  function removeItem(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx))
  }

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const discountAmt = discountType === "PERCENT" ? subtotal * discount / 100 : discount
  const afterDiscount = Math.max(0, subtotal - discountAmt)
  const serviceAmt = afterDiscount * serviceChargePct / 100
  const gstAmt = (afterDiscount + serviceAmt) * gstRate / 100
  const total = afterDiscount + serviceAmt + gstAmt

  async function placeOrder(payNow: boolean) {
    if (cart.length === 0) { toast.error("Add items to cart first"); return }
    if (!selectedBranchId) { toast.error("Select a branch"); return }
    setSubmitting(true)
    try {
      const order = await apiFetch<{ id: string; orderNumber: string }>("/orders", {
        method: "POST",
        body: JSON.stringify({
          branchId: selectedBranchId,
          tableId: selectedTableId || undefined,
          customerId: customer?.id,
          orderType,
          discount,
          discountType,
          serviceChargePercent: serviceChargePct,
          gstRate,
          notes: "",
          items: cart.map(c => ({ menuItemId: c.menuItemId, quantity: c.quantity, variantId: c.variantId, notes: "" })),
        }),
      })

      if (payNow) {
        await apiFetch("/payments", {
          method: "POST",
          body: JSON.stringify({ orderId: order.id, method: paymentMethod, amount: total }),
        })
        toast.success(`Order #${order.orderNumber} placed & paid`)
      } else {
        toast.success(`Order #${order.orderNumber} placed — pay later`)
      }

      setCart([])
      setCustomer(null)
      setCustomerSearch("")
      setSelectedTableId("")
      setDiscount(0)
      setServiceChargePct(0)
      setGstRate(5)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to place order")
    } finally {
      setSubmitting(false)
    }
  }

  const filteredItems = items.filter(item => {
    const matchesCat = selectedCategoryId ? item.categoryId === selectedCategoryId : true
    const matchesSearch = search ? item.name.toLowerCase().includes(search.toLowerCase()) : true
    return matchesCat && matchesSearch && item.isAvailable
  })

  return (
    <div className="flex h-[calc(100vh-73px)] overflow-hidden">

      {/* Left — Categories */}
      <div className="w-48 bg-white border-r border-gray-200 flex flex-col overflow-y-auto shrink-0">
        <div className="px-3 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Categories</p>
        </div>
        <div className="p-2 space-y-1">
          {catLoading ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />) : (
            <>
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${!selectedCategoryId ? "bg-orange-500 text-white" : "text-gray-600 hover:bg-gray-100"}`}
              >All</button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategoryId === cat.id ? "bg-orange-500 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                >{cat.name}</button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Middle — Items */}
      <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-white flex items-center gap-3">
          <p className="text-sm font-semibold text-gray-700 shrink-0">Menu Items</p>
          <input
            type="text"
            placeholder="Search items…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {itemLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">No items found</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filteredItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-orange-400 hover:shadow-sm transition-all text-left group"
                >
                  <div className="h-24 bg-gray-100 flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                    <span className="text-3xl">{item.isVeg ? "🥗" : "🍖"}</span>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs font-bold text-orange-600">{formatCurrency(item.price)}</p>
                      <span className={`w-2 h-2 rounded-full ${item.isVeg ? "bg-green-500" : "bg-red-400"}`} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right — Cart */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0">

        {/* Order config */}
        <div className="p-3 border-b border-gray-100 space-y-2">
          <select value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)} className={inputCls}>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="flex gap-1">
            {(["DINE_IN", "TAKEAWAY", "DELIVERY"] as OrderType[]).map(t => (
              <button key={t} onClick={() => setOrderType(t)}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${orderType === t ? "bg-orange-500 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >{t.replace("_", "-")}</button>
            ))}
          </div>
          {orderType === "DINE_IN" && tables.length > 0 && (
            <select value={selectedTableId} onChange={e => setSelectedTableId(e.target.value)} className={inputCls}>
              <option value="">— No table —</option>
              {tables.map(t => <option key={t.id} value={t.id}>{t.tableNumber}</option>)}
            </select>
          )}
          <div className="relative">
            <input
              type="text"
              placeholder="Customer phone…"
              value={customerSearch}
              onChange={e => { setCustomerSearch(e.target.value); searchCustomer(e.target.value) }}
              className={inputCls}
            />
            {customerSearching && <p className="text-xs text-gray-400 mt-0.5 px-1">Searching…</p>}
            {!customerSearching && customerSearch.length >= 7 && (
              customer
                ? <div className="flex items-center gap-2 mt-1 px-2 py-1.5 bg-green-50 rounded-lg border border-green-200">
                    <User className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs font-medium text-green-700">{customer.name}</span>
                    <span className="ml-auto text-xs text-orange-600">{customer.loyaltyPoints} pts</span>
                  </div>
                : <p className="text-xs text-gray-400 mt-0.5 px-1">Walk-in customer</p>
            )}
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">No items yet</div>
          ) : (
            <div className="p-3 space-y-2">
              {cart.map((item, idx) => (
                <div key={`${item.menuItemId}-${item.variantId}-${idx}`} className="bg-gray-50 rounded-lg p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                      {item.variantName && <p className="text-xs text-gray-500">{item.variantName}</p>}
                    </div>
                    <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-400 shrink-0"><X className="w-3 h-3" /></button>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(idx, -1)} className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100"><Minus className="w-2.5 h-2.5" /></button>
                      <span className="text-xs font-semibold w-5 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(idx, 1)} className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100"><Plus className="w-2.5 h-2.5" /></button>
                    </div>
                    <p className="text-xs font-bold text-gray-700">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className="border-t border-gray-100 p-3 space-y-2">
          <div className="flex gap-2">
            <select value={discountType} onChange={e => setDiscountType(e.target.value as DiscountType)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-orange-400 w-20">
              <option value="FLAT">₹ Flat</option>
              <option value="PERCENT">% Off</option>
            </select>
            <input type="number" min={0} value={discount} onChange={e => setDiscount(Number(e.target.value))}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
              placeholder="Discount" />
          </div>
          <div className="flex gap-2">
            <input type="number" min={0} max={100} value={serviceChargePct} onChange={e => setServiceChargePct(Number(e.target.value))}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
              placeholder="Service charge %" />
            <input type="number" min={0} max={100} value={gstRate} onChange={e => setGstRate(Number(e.target.value))}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
              placeholder="GST %" />
          </div>
          <div className="space-y-1 pt-1 border-t border-gray-100 text-xs">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {discountAmt > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>-{formatCurrency(discountAmt)}</span></div>}
            {serviceAmt > 0 && <div className="flex justify-between text-gray-500"><span>Service ({serviceChargePct}%)</span><span>{formatCurrency(serviceAmt)}</span></div>}
            <div className="flex justify-between text-gray-500"><span>GST ({gstRate}%)</span><span>{formatCurrency(gstAmt)}</span></div>
            <div className="flex justify-between font-bold text-base text-orange-600 pt-1 border-t border-gray-200"><span>TOTAL</span><span>{formatCurrency(total)}</span></div>
          </div>
        </div>

        {/* Payment */}
        <div className="border-t border-gray-200 p-3 space-y-2">
          <div className="grid grid-cols-4 gap-1">
            {([["CASH", Banknote], ["CARD", CreditCard], ["UPI", Smartphone], ["ONLINE", Globe]] as [PaymentMethod, React.ElementType][]).map(([method, Icon]) => (
              <button key={method} onClick={() => setPaymentMethod(method)}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-medium transition-colors ${paymentMethod === method ? "bg-orange-500 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                <Icon className="w-4 h-4" />
                {method}
              </button>
            ))}
          </div>
          <button
            onClick={() => placeOrder(true)}
            disabled={submitting || cart.length === 0}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >{submitting ? "Placing…" : `Place Order + Pay ${formatCurrency(total)}`}</button>
          <button
            onClick={() => placeOrder(false)}
            disabled={submitting || cart.length === 0}
            className="w-full border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >Pay Later</button>
        </div>
      </div>

      {/* Variant picker modal */}
      {variantModal && (
        <VariantModal
          item={variantModal.item}
          variants={variantModal.variants}
          onSelect={(item, variant) => addToCart(item, variant)}
          onClose={() => setVariantModal(null)}
        />
      )}
    </div>
  )
}
