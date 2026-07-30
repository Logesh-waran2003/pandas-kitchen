export const SmsTemplates = {
  orderPlaced: (orderNum: string, restaurantName: string) =>
    `Hi! Your order #${orderNum} at ${restaurantName} has been received. We will notify you once it is accepted.`,

  orderAccepted: (orderNum: string, etaMins: number, pickupCode?: string) => {
    const eta = etaMins > 0 ? ` Ready in ~${etaMins} mins.` : ''
    const code = pickupCode ? ` Pickup code: ${pickupCode}.` : ''
    return `Your order #${orderNum} has been accepted!${eta}${code}`
  },

  orderReady: (orderNum: string, pickupCode?: string) => {
    const code = pickupCode ? ` Show code ${pickupCode} at the counter.` : ''
    return `Your order #${orderNum} is ready for pickup!${code} Thank you.`
  },

  orderCancelled: (orderNum: string) =>
    `Your order #${orderNum} has been cancelled. We apologize for the inconvenience.`,
}
