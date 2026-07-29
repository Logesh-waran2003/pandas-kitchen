"use client"
import { useCartStore, OrderType } from "@/stores/cart.store"

interface Props {
  deliveryEnabled?: boolean
  takeawayEnabled?: boolean
}

export default function OrderTypeSelector({ deliveryEnabled = true, takeawayEnabled = true }: Props) {
  const { orderType, setOrderType } = useCartStore()

  const options: { type: OrderType; label: string; emoji: string; show: boolean }[] = [
    { type: "DINE_IN",  label: "Dine In",   emoji: "🪑", show: true },
    { type: "TAKEAWAY", label: "Takeaway",   emoji: "🥡", show: takeawayEnabled },
    { type: "DELIVERY", label: "Delivery",   emoji: "🚚", show: deliveryEnabled },
  ]

  const visible = options.filter((o) => o.show)

  return (
    <div className="flex gap-2">
      {visible.map((opt) => (
        <button
          key={opt.type}
          onClick={() => setOrderType(opt.type)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            orderType === opt.type
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
          }`}
          aria-pressed={orderType === opt.type}
        >
          <span>{opt.emoji}</span>
          {opt.label}
        </button>
      ))}
    </div>
  )
}
