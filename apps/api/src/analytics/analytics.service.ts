import { Injectable, BadRequestException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(restaurantId: string) {
    const [totalOrders, totalTables, totalCustomers, revenueAgg, todayOrders, todayRevenueAgg] =
      await Promise.all([
        this.prisma.order.count({
          where: { restaurantId, status: { not: "CANCELLED" } },
        }),
        this.prisma.table.count({ where: { restaurantId, isActive: true } }),
        this.prisma.customer.count({ where: { restaurantId, isActive: true } }),
        this.prisma.order.aggregate({
          where: { restaurantId, status: { not: "CANCELLED" } },
          _sum: { total: true },
        }),
        this.prisma.order.count({
          where: {
            restaurantId,
            status: { not: "CANCELLED" },
            createdAt: { gte: this.startOfToday() },
          },
        }),
        this.prisma.order.aggregate({
          where: {
            restaurantId,
            status: { not: "CANCELLED" },
            createdAt: { gte: this.startOfToday() },
          },
          _sum: { total: true },
        }),
      ])

    return {
      totalRevenue: Number(revenueAgg._sum.total ?? 0),
      totalOrders,
      totalTables,
      totalCustomers,
      todayRevenue: Number(todayRevenueAgg._sum.total ?? 0),
      todayOrders,
    }
  }

  async getDailyRevenue(restaurantId: string) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        status: { not: "CANCELLED" },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: "asc" },
    })

    // Group by date string YYYY-MM-DD
    const byDate = new Map<string, number>()
    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 10)
      byDate.set(key, (byDate.get(key) ?? 0) + Number(order.total))
    }

    return Array.from(byDate.entries()).map(([date, revenue]) => ({ date, revenue }))
  }

  async getPopularItems(restaurantId: string) {
    const result = await this.prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: {
        order: { restaurantId, status: { not: "CANCELLED" } },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    })

    const ids = result.map((r) => r.menuItemId)
    const items = await this.prisma.menuItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, price: true, imageUrl: true },
    })

    const itemMap = new Map(items.map((i) => [i.id, i]))

    return result.map((r) => {
      const item = itemMap.get(r.menuItemId)
      return {
        menuItemId: r.menuItemId,
        name: item?.name ?? 'Unknown Item',
        totalQuantity: r._sum.quantity ?? 0,
        totalRevenue: Number(item?.price ?? 0) * (r._sum.quantity ?? 0),
        imageUrl: item?.imageUrl ?? null,
      }
    })
  }

  async getOrdersByStatus(restaurantId: string) {
    const result = await this.prisma.order.groupBy({
      by: ["status"],
      where: { restaurantId },
      _count: { id: true },
    })

    return result.map((r) => ({ status: r.status, count: r._count.id }))
  }

  async getDailyPnL(restaurantId: string, branchId?: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date()
    const start = this.startOfDayIST(targetDate)
    const end = this.endOfDayIST(targetDate)

    const where: any = {
      restaurantId,
      createdAt: { gte: start, lte: end },
    }
    if (branchId) where.branchId = branchId

    const [orders, payments] = await Promise.all([
      this.prisma.order.findMany({
        where: { ...where, status: { notIn: ["CANCELLED"] } },
        select: { total: true, subtotal: true, gstAmount: true, discount: true },
      }),
      this.prisma.payment.findMany({
        where: { restaurantId, createdAt: { gte: start, lte: end }, status: "COMPLETED" },
        select: { amount: true, method: true },
      }),
    ])

    const revenue = orders.reduce((s, o) => s + Number(o.total), 0)
    const tax = orders.reduce((s, o) => s + Number(o.gstAmount ?? 0), 0)
    const discount = orders.reduce((s, o) => s + Number(o.discount ?? 0), 0)
    const byMode = payments.reduce((acc, p) => {
      const key = p.method as string
      acc[key] = (acc[key] ?? 0) + Number(p.amount)
      return acc
    }, {} as Record<string, number>)

    return {
      date: targetDate.toISOString().slice(0, 10),
      revenue,
      tax,
      discount,
      netRevenue: revenue - tax,
      orderCount: orders.length,
      byMode,
    }
  }

  private startOfDayIST(date: Date): Date {
    const IST_OFFSET = 5.5 * 60 * 60 * 1000
    const inIST = new Date(date.getTime() + IST_OFFSET)
    const dayStr = inIST.toISOString().slice(0, 10)
    const startIST = new Date(dayStr + "T00:00:00.000Z")
    return new Date(startIST.getTime() - IST_OFFSET)
  }

  private endOfDayIST(date: Date): Date {
    const IST_OFFSET = 5.5 * 60 * 60 * 1000
    const inIST = new Date(date.getTime() + IST_OFFSET)
    const dayStr = inIST.toISOString().slice(0, 10)
    const endIST = new Date(dayStr + "T23:59:59.999Z")
    return new Date(endIST.getTime() - IST_OFFSET)
  }

  private startOfToday() {
    // Use restaurant timezone (IST = UTC+5:30)
    // For now, offset to IST until per-restaurant timezone is wired
    const now = new Date()
    const IST_OFFSET = 5.5 * 60 * 60 * 1000 // 5h30m in ms
    const nowIST = new Date(now.getTime() + IST_OFFSET)
    // Start of day in IST, converted back to UTC for DB query
    const startIST = new Date(nowIST.toISOString().slice(0, 10) + 'T00:00:00.000Z')
    return new Date(startIST.getTime() - IST_OFFSET)
  }

  async getOnlineOrderStats(restaurantId: string, branchId?: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date()
    const start = this.startOfDayIST(targetDate)
    const end = this.endOfDayIST(targetDate)

    const baseWhere: any = {
      restaurantId,
      orderSource: "ONLINE",
      status: { not: "CANCELLED" },
      createdAt: { gte: start, lte: end },
    }
    if (branchId) baseWhere.branchId = branchId

    const [onlineOrders, takeawayOrders, deliveryOrders, revenueAgg, pendingOnline] =
      await Promise.all([
        this.prisma.order.count({ where: baseWhere }),
        this.prisma.order.count({
          where: { ...baseWhere, orderType: "TAKEAWAY" },
        }),
        this.prisma.order.count({
          where: { ...baseWhere, orderType: "DELIVERY" },
        }),
        this.prisma.order.aggregate({
          where: baseWhere,
          _sum: { total: true },
          _avg: { total: true },
        }),
        this.prisma.order.count({
          where: {
            restaurantId,
            orderSource: "ONLINE",
            status: "PENDING",
            ...(branchId ? { branchId } : {}),
          },
        }),
      ])

    const onlineRevenue = Number(revenueAgg._sum.total ?? 0)
    const avgOnlineOrderValue = Number(revenueAgg._avg.total ?? 0)

    return {
      onlineOrders,
      takeawayOrders,
      deliveryOrders,
      onlineRevenue,
      avgOnlineOrderValue,
      pendingOnline,
    }
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  async getReport(restaurantId: string, type: string, from: string, to: string, branchId?: string) {
    const start = new Date(from)
    const end = new Date(to)
    end.setHours(23, 59, 59, 999)

    switch (type) {
      case "today-sales":   return this.getTodaySales(restaurantId, branchId)
      case "daywise":       return this.getDaywiseSales(restaurantId, start, end, branchId)
      case "item-wise":     return this.getItemWiseSales(restaurantId, start, end, branchId)
      case "payment-modes": return this.getPaymentModeBreakdown(restaurantId, start, end, branchId)
      case "cancelled":     return this.getCancelledOrders(restaurantId, start, end, branchId)
      case "customer-data":        return this.getTopCustomers(restaurantId, start, end)
      case "repeated-customers":   return this.getRepeatedCustomers(restaurantId, start, end)
      case "employee-sales":       return this.getEmployeeSales(restaurantId, start, end, branchId)
      case "time-wise":            return this.getTimeWiseSales(restaurantId, start, end, branchId)
      case "monthwise":            return this.getMonthwiseSales(restaurantId, start, end, branchId)
      default:                     throw new BadRequestException(`Unknown report type: ${type}`)
    }
  }

  private async getTodaySales(restaurantId: string, branchId?: string) {
    const IST_OFFSET = 5.5 * 60 * 60 * 1000
    const now = new Date()
    const istNow = new Date(now.getTime() + IST_OFFSET)
    const start = new Date(
      Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - IST_OFFSET,
    )

    const where: any = {
      restaurantId,
      createdAt: { gte: start },
      status: { notIn: ["CANCELLED"] },
    }
    if (branchId) where.branchId = branchId

    const orders = await this.prisma.order.findMany({
      where,
      select: { total: true, status: true, orderNumber: true, createdAt: true },
    })
    return {
      totalOrders: orders.length,
      revenue: orders.reduce((s, o) => s + Number(o.total), 0),
      orders,
    }
  }

  private async getDaywiseSales(restaurantId: string, start: Date, end: Date, branchId?: string) {
    const where: any = {
      restaurantId,
      createdAt: { gte: start, lte: end },
      status: { notIn: ["CANCELLED"] },
    }
    if (branchId) where.branchId = branchId

    const orders = await this.prisma.order.findMany({
      where,
      select: { total: true, createdAt: true },
    })

    const byDate: Record<string, { date: string; orders: number; revenue: number }> = {}
    for (const o of orders) {
      const d = o.createdAt.toISOString().slice(0, 10)
      if (!byDate[d]) byDate[d] = { date: d, orders: 0, revenue: 0 }
      byDate[d].orders++
      byDate[d].revenue += Number(o.total)
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  }

  private async getItemWiseSales(restaurantId: string, start: Date, end: Date, branchId?: string) {
    const orderWhere: any = {
      restaurantId,
      createdAt: { gte: start, lte: end },
      status: { notIn: ["CANCELLED"] },
    }
    if (branchId) orderWhere.branchId = branchId

    // Prisma groupBy with a nested relation filter triggers a known circular-type issue;
    // cast to any to work around it while keeping runtime correctness.
    const grouped = await (this.prisma.orderItem.groupBy as any)({
      by: ["menuItemId"],
      where: { order: orderWhere },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: "desc" } },
    }) as Array<{ menuItemId: string; _sum: { quantity: number | null; totalPrice: unknown } }>

    const ids = grouped.map((r) => r.menuItemId)
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    })
    const nameMap = new Map(menuItems.map((m) => [m.id, m.name]))

    return grouped.map((r) => ({
      itemId: r.menuItemId,
      name: nameMap.get(r.menuItemId) ?? "Unknown",
      qty: r._sum.quantity ?? 0,
      revenue: Number(r._sum.totalPrice ?? 0),
    }))
  }

  private async getPaymentModeBreakdown(restaurantId: string, start: Date, end: Date, branchId?: string) {
    const orderWhere: any = { restaurantId }
    if (branchId) orderWhere.branchId = branchId

    const payments = await this.prisma.payment.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: "COMPLETED",
        order: orderWhere,
      },
      select: { method: true, amount: true },
    })

    const byMode: Record<string, number> = {}
    for (const p of payments) {
      const key = p.method as string
      byMode[key] = (byMode[key] ?? 0) + Number(p.amount)
    }
    return Object.entries(byMode).map(([mode, amount]) => ({ mode, amount }))
  }

  private async getCancelledOrders(restaurantId: string, start: Date, end: Date, branchId?: string) {
    const where: any = {
      restaurantId,
      status: "CANCELLED",
      createdAt: { gte: start, lte: end },
    }
    if (branchId) where.branchId = branchId

    return this.prisma.order.findMany({
      where,
      select: { id: true, orderNumber: true, total: true, createdAt: true, tableId: true },
      orderBy: { createdAt: "desc" },
    })
  }

  private async getRepeatedCustomers(restaurantId: string, start: Date, end: Date) {
    const orders = await this.prisma.order.findMany({
      where: { restaurantId, createdAt: { gte: start, lte: end }, status: { not: "CANCELLED" } },
      select: { customerId: true, total: true },
    })
    const byCustomer: Record<string, { count: number; spent: number }> = {}
    for (const o of orders) {
      if (!o.customerId) continue
      if (!byCustomer[o.customerId]) byCustomer[o.customerId] = { count: 0, spent: 0 }
      byCustomer[o.customerId].count++
      byCustomer[o.customerId].spent += Number(o.total)
    }
    const repeatedIds = Object.entries(byCustomer)
      .filter(([, v]) => v.count > 1)
      .map(([id]) => id)
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: repeatedIds } },
      select: { id: true, name: true, phone: true },
    })
    return customers
      .map((c) => ({
        ...c,
        orderCount: byCustomer[c.id].count,
        totalSpent: byCustomer[c.id].spent,
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
  }

  private async getEmployeeSales(restaurantId: string, start: Date, end: Date, branchId?: string) {
    const where: any = {
      restaurantId,
      createdAt: { gte: start, lte: end },
      status: { not: "CANCELLED" },
    }
    if (branchId) where.branchId = branchId
    const orders = await this.prisma.order.findMany({
      where,
      select: { createdById: true, total: true },
    })
    const byStaff: Record<string, { count: number; revenue: number }> = {}
    for (const o of orders) {
      const key = o.createdById ?? "unknown"
      if (!byStaff[key]) byStaff[key] = { count: 0, revenue: 0 }
      byStaff[key].count++
      byStaff[key].revenue += Number(o.total)
    }
    const staffIds = Object.keys(byStaff).filter((id) => id !== "unknown")
    const users = await this.prisma.user.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, name: true, role: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))
    return Object.entries(byStaff)
      .map(([id, data]) => ({
        staffId: id,
        name: userMap.get(id)?.name ?? "Unknown",
        role: userMap.get(id)?.role ?? "-",
        orderCount: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }

  private async getTimeWiseSales(restaurantId: string, start: Date, end: Date, branchId?: string) {
    const where: any = {
      restaurantId,
      createdAt: { gte: start, lte: end },
      status: { not: "CANCELLED" },
    }
    if (branchId) where.branchId = branchId
    const orders = await this.prisma.order.findMany({ where, select: { createdAt: true, total: true } })
    const IST_OFFSET = 5.5 * 60 * 60 * 1000
    const byHour: Record<number, { count: number; revenue: number }> = {}
    for (let i = 0; i < 24; i++) byHour[i] = { count: 0, revenue: 0 }
    for (const o of orders) {
      const istTime = new Date(o.createdAt.getTime() + IST_OFFSET)
      const hour = istTime.getUTCHours()
      byHour[hour].count++
      byHour[hour].revenue += Number(o.total)
    }
    return Object.entries(byHour).map(([hour, data]) => ({
      hour: Number(hour),
      label: `${String(Number(hour)).padStart(2, "0")}:00`,
      orderCount: data.count,
      revenue: data.revenue,
    }))
  }

  private async getMonthwiseSales(restaurantId: string, start: Date, end: Date, branchId?: string) {
    const where: any = {
      restaurantId,
      createdAt: { gte: start, lte: end },
      status: { not: "CANCELLED" },
    }
    if (branchId) where.branchId = branchId
    const orders = await this.prisma.order.findMany({ where, select: { createdAt: true, total: true } })
    const byMonth: Record<string, { count: number; revenue: number }> = {}
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 7) // YYYY-MM
      if (!byMonth[key]) byMonth[key] = { count: 0, revenue: 0 }
      byMonth[key].count++
      byMonth[key].revenue += Number(o.total)
    }
    return Object.entries(byMonth)
      .map(([month, data]) => ({ month, orderCount: data.count, revenue: data.revenue }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }

  private async getTopCustomers(restaurantId: string, _start: Date, _end: Date) {
    return this.prisma.customer.findMany({
      where: { restaurantId },
      select: {
        id: true,
        name: true,
        phone: true,
        totalOrders: true,
        totalSpent: true,
      },
      orderBy: { totalSpent: "desc" },
      take: 20,
    })
  }
}
