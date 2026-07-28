import { Injectable } from "@nestjs/common"
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
}
