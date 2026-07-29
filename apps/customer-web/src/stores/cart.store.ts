import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface CartItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
  variantId?: string
  variantName?: string
  notes?: string
}

export type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY"

interface CartStore {
  // Table context
  items: CartItem[]
  tableId: string | null
  branchId: string | null
  restaurantId: string | null

  // Order options
  orderType: OrderType
  scheduledFor: string | null
  deliveryAddress: string | null
  tip: number
  couponCode: string | null
  couponDiscount: number
  specialInstructions: string | null

  // Customer details
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null

  // Actions — table/items
  setTable: (tableId: string, branchId: string, restaurantId: string) => void
  setOnlineContext: (branchId: string, restaurantId: string) => void
  addItem: (item: CartItem) => void
  removeItem: (menuItemId: string, variantId?: string) => void
  updateQty: (menuItemId: string, variantId: string | undefined, delta: number) => void
  updateNote: (menuItemId: string, variantId: string | undefined, notes: string) => void
  clearCart: () => void
  total: () => number

  // Actions — order options
  setOrderType: (type: OrderType) => void
  setScheduledFor: (dt: string | null) => void
  setDeliveryAddress: (addr: string | null) => void
  setTip: (amount: number) => void
  applyCoupon: (code: string, discount: number) => void
  clearCoupon: () => void
  setSpecialInstructions: (text: string | null) => void

  // Actions — customer details
  setCustomerDetails: (name: string, phone: string, email: string | null) => void
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      tableId: null,
      branchId: null,
      restaurantId: null,

      orderType: "DINE_IN",
      scheduledFor: null,
      deliveryAddress: null,
      tip: 0,
      couponCode: null,
      couponDiscount: 0,
      specialInstructions: null,

      customerName: null,
      customerPhone: null,
      customerEmail: null,

      // ── Table/items ──────────────────────────────────────────────────────────
      setTable: (tableId, branchId, restaurantId) =>
        set({ tableId, branchId, restaurantId }),

      setOnlineContext: (branchId, restaurantId) =>
        set({ branchId, restaurantId, tableId: null, orderType: "TAKEAWAY" }),

      addItem: (item) =>
        set((s) => {
          const existing = s.items.find(
            (i) => i.menuItemId === item.menuItemId && i.variantId === item.variantId
          )
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.menuItemId === item.menuItemId && i.variantId === item.variantId
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            }
          }
          return { items: [...s.items, item] }
        }),

      removeItem: (menuItemId, variantId) =>
        set((s) => ({
          items: s.items.filter(
            (i) => !(i.menuItemId === menuItemId && i.variantId === variantId)
          ),
        })),

      updateQty: (menuItemId, variantId, delta) =>
        set((s) => ({
          items: s.items
            .map((i) =>
              i.menuItemId === menuItemId && i.variantId === variantId
                ? { ...i, quantity: i.quantity + delta }
                : i
            )
            .filter((i) => i.quantity > 0),
        })),

      updateNote: (menuItemId, variantId, notes) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.menuItemId === menuItemId && i.variantId === variantId
              ? { ...i, notes }
              : i
          ),
        })),

      clearCart: () =>
        set({
          items: [],
          orderType: "DINE_IN",
          scheduledFor: null,
          deliveryAddress: null,
          tip: 0,
          couponCode: null,
          couponDiscount: 0,
          specialInstructions: null,
        }),

      total: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      // ── Order options ────────────────────────────────────────────────────────
      setOrderType: (type) => {
        const update: Partial<CartStore> = { orderType: type }
        if (type !== "DELIVERY") update.deliveryAddress = null
        set(update)
      },

      setScheduledFor: (dt) => set({ scheduledFor: dt }),

      setDeliveryAddress: (addr) => set({ deliveryAddress: addr }),

      setTip: (amount) => set({ tip: amount }),

      applyCoupon: (code, discount) =>
        set({ couponCode: code, couponDiscount: discount }),

      clearCoupon: () => set({ couponCode: null, couponDiscount: 0 }),

      setSpecialInstructions: (text) => set({ specialInstructions: text }),

      // ── Customer details ────────────────────────────────────────────────────
      setCustomerDetails: (name, phone, email) =>
        set({ customerName: name, customerPhone: phone, customerEmail: email }),
    }),
    { name: "pk-cart" }
  )
)
