import { create } from "zustand"
import { persist, PersistStorage, StorageValue } from "zustand/middleware"

interface CustomerAuth {
  token: string | null
  customerId: string | null
  name: string | null
  phone: string | null
  restaurantId: string | null
}

interface CustomerAuthStore extends CustomerAuth {
  setAuth: (auth: { token: string; customerId: string; name: string; phone: string; restaurantId: string }) => void
  clearAuth: () => void
  isLoggedIn: () => boolean
}

// Store state flat (not nested under {state,...}) so that existing
// raw localStorage readers (api.ts, order page) can still read token/customerId.
const flatStorage: PersistStorage<CustomerAuthStore> = {
  getItem: (name): StorageValue<CustomerAuthStore> | null => {
    if (typeof window === "undefined") return null
    try {
      const raw = localStorage.getItem(name)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      // Already zustand-wrapped — return as-is
      if ("state" in parsed) return parsed as StorageValue<CustomerAuthStore>
      // Flat format from existing code — wrap it for zustand to consume
      return { state: parsed as CustomerAuthStore, version: 0 }
    } catch { return null }
  },
  setItem: (name, value: StorageValue<CustomerAuthStore>) => {
    if (typeof window === "undefined") return
    // Write flat (no zustand wrapper) so existing raw readers keep working
    localStorage.setItem(name, JSON.stringify(value.state))
  },
  removeItem: (name) => {
    if (typeof window !== "undefined") localStorage.removeItem(name)
  },
}

export const useCustomerAuthStore = create<CustomerAuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      customerId: null,
      name: null,
      phone: null,
      restaurantId: null,
      setAuth: (auth) => set(auth),
      clearAuth: () =>
        set({ token: null, customerId: null, name: null, phone: null, restaurantId: null }),
      isLoggedIn: () => !!get().token,
    }),
    {
      name: "pk-customer-auth",
      storage: flatStorage,
    }
  )
)
