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
      case "customer-data": return this.getTopCustomers(restaurantId, start, end)
      default:              throw new BadRequestException(`Unknown report type: ${type}`)
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

    const items = await this.prisma.orderItem.groupBy({
      by: ["menuItemId", "name"],
      where: { order: orderWhere },
      _sum: { quantity: true, totalPrice: true },
      _count: true,
      orderBy: { _sum: { quantity: "desc" } },
    })

    return items.map((i) => ({
      itemId: i.menuItemId,
      name: i.name,
      qty: i._sum.quantity ?? 0,
      revenue: Number(i._sum.totalPrice ?? 0),
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
