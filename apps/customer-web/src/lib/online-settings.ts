export interface OnlineSettings {
  onlineOrderingEnabled: boolean
  deliveryEnabled: boolean
  takeawayEnabled: boolean
  deliveryFee: number
  packagingFee: number
  serviceChargePercent: number
  estimatedPrepMins: number
  pickupPrepMins: number
  minOrderValue: number
  gstRate: number
  loyaltyPointsPerRupee: number
  loyaltyRedemptionRate: number
}

export async function fetchOnlineSettings(restaurantId: string): Promise<OnlineSettings> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"
  const res = await fetch(`${API_BASE}/settings/${restaurantId}/online-settings`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to fetch online settings")
  const data = await res.json()
  return {
    ...data,
    gstRate: data.gstRate ?? 5,
    loyaltyPointsPerRupee: data.loyaltyPointsPerRupee ?? 1,
    loyaltyRedemptionRate: data.loyaltyRedemptionRate ?? 0.25,
  }
}
