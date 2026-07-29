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

interface CartStore {
  items: CartItem[]
  tableId: string | null
  branchId: string | null
  restaurantId: string | null
  setTable: (tableId: string, branchId: string, restaurantId: string) => void
  addItem: (item: CartItem) => void
  removeItem: (menuItemId: string, variantId?: string) => void
  updateQty: (menuItemId: string, variantId: string | undefined, delta: number) => void
  updateNote: (menuItemId: string, variantId: string | undefined, notes: string) => void
  clearCart: () => void
  total: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      tableId: null,
      branchId: null,
      restaurantId: null,
      setTable: (tableId, branchId, restaurantId) => set({ tableId, branchId, restaurantId }),
      addItem: (item) => set((s) => {
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
      removeItem: (menuItemId, variantId) => set((s) => ({
        items: s.items.filter(
          (i) => !(i.menuItemId === menuItemId && i.variantId === variantId)
        ),
      })),
      updateQty: (menuItemId, variantId, delta) => set((s) => ({
        items: s.items
          .map((i) =>
            i.menuItemId === menuItemId && i.variantId === variantId
              ? { ...i, quantity: i.quantity + delta }
              : i
          )
          .filter((i) => i.quantity > 0),
      })),
      updateNote: (menuItemId, variantId, notes) => set((s) => ({
        items: s.items.map((i) =>
          i.menuItemId === menuItemId && i.variantId === variantId
            ? { ...i, notes }
            : i
        ),
      })),
      clearCart: () => set({ items: [] }),
      total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    { name: "pk-cart" }
  )
)
