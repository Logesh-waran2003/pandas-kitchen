import { BadRequestException } from "@nestjs/common"
import { AnalyticsService } from "./analytics.service"

function makePrisma() {
  return {
    order: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    table: { count: jest.fn() },
    customer: { count: jest.fn(), findMany: jest.fn() },
    orderItem: { groupBy: jest.fn() },
    menuItem: { findMany: jest.fn() },
    payment: { findMany: jest.fn() },
  }
}

const RESTAURANT_ID = "rest-1"
const FROM = "2026-01-01"
const TO = "2026-01-31"

describe("AnalyticsService — reports", () => {
  let service: AnalyticsService
  let prisma: ReturnType<typeof makePrisma>

  beforeEach(() => {
    prisma = makePrisma()
    service = new AnalyticsService(prisma as any)
  })

  // ── getReport ──────────────────────────────────────────────────────────────

  describe("getReport", () => {
    it("unknown type → throws BadRequestException", async () => {
      await expect(service.getReport(RESTAURANT_ID, "unknown-type", FROM, TO))
        .rejects.toThrow(BadRequestException)
    })

    it('"cancelled" → calls order.findMany with status: "CANCELLED"', async () => {
      prisma.order.findMany.mockResolvedValue([])

      await service.getReport(RESTAURANT_ID, "cancelled", FROM, TO)

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "CANCELLED" }),
        }),
      )
    })

    it('"customer-data" → calls customer.findMany ordered by totalSpent desc', async () => {
      prisma.customer.findMany.mockResolvedValue([])

      await service.getReport(RESTAURANT_ID, "customer-data", FROM, TO)

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { restaurantId: RESTAURANT_ID },
          orderBy: { totalSpent: "desc" },
        }),
      )
    })

    it('"today-sales" → calls order.findMany for today\'s orders', async () => {
      prisma.order.findMany.mockResolvedValue([])

      await service.getReport(RESTAURANT_ID, "today-sales", FROM, TO)

      expect(prisma.order.findMany).toHaveBeenCalled()
    })
  })

  // ── getDailyRevenue ────────────────────────────────────────────────────────

  describe("getDailyRevenue", () => {
    it("groups orders by YYYY-MM-DD and sums revenue per day", async () => {
      const day1 = new Date("2026-01-10T08:00:00.000Z")
      const day2 = new Date("2026-01-11T08:00:00.000Z")

      prisma.order.findMany.mockResolvedValue([
        { createdAt: day1, total: 100 },
        { createdAt: day1, total: 200 },
        { createdAt: day2, total: 50 },
      ])

      const result = await service.getDailyRevenue(RESTAURANT_ID)

      expect(result).toHaveLength(2)
      const jan10 = result.find((r) => r.date === "2026-01-10")
      const jan11 = result.find((r) => r.date === "2026-01-11")
      expect(jan10?.revenue).toBe(300)
      expect(jan11?.revenue).toBe(50)
    })

    it("returns empty array when no orders", async () => {
      prisma.order.findMany.mockResolvedValue([])

      const result = await service.getDailyRevenue(RESTAURANT_ID)

      expect(result).toEqual([])
    })

    it("each item has { date, revenue } shape", async () => {
      prisma.order.findMany.mockResolvedValue([
        { createdAt: new Date("2026-01-05T10:00:00.000Z"), total: 75 },
      ])

      const result = await service.getDailyRevenue(RESTAURANT_ID)

      expect(result[0]).toMatchObject({ date: expect.any(String), revenue: expect.any(Number) })
    })
  })

  // ── getOrdersByStatus ──────────────────────────────────────────────────────

  describe("getOrdersByStatus", () => {
    it("returns array of { status, count }", async () => {
      prisma.order.groupBy.mockResolvedValue([
        { status: "PENDING", _count: { id: 5 } },
        { status: "COMPLETED", _count: { id: 12 } },
        { status: "CANCELLED", _count: { id: 3 } },
      ])

      const result = await service.getOrdersByStatus(RESTAURANT_ID)

      expect(result).toEqual([
        { status: "PENDING", count: 5 },
        { status: "COMPLETED", count: 12 },
        { status: "CANCELLED", count: 3 },
      ])
    })

    it("queries with restaurantId filter", async () => {
      prisma.order.groupBy.mockResolvedValue([])

      await service.getOrdersByStatus(RESTAURANT_ID)

      expect(prisma.order.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { restaurantId: RESTAURANT_ID } }),
      )
    })
  })

  // ── getDailyPnL ────────────────────────────────────────────────────────────

  describe("getDailyPnL", () => {
    it("returns { date, revenue, tax, discount, netRevenue, orderCount, byMode }", async () => {
      prisma.order.findMany.mockResolvedValue([
        { total: 500, subtotal: 450, gstAmount: 40, discount: 10 },
        { total: 300, subtotal: 270, gstAmount: 25, discount: 5 },
      ])
      prisma.payment.findMany.mockResolvedValue([
        { amount: 500, method: "CASH" },
        { amount: 300, method: "UPI" },
      ])

      const result = await service.getDailyPnL(RESTAURANT_ID)

      expect(result).toMatchObject({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        revenue: 800,
        tax: 65,
        discount: 15,
        netRevenue: 800 - 65,   // revenue - tax
        orderCount: 2,
        byMode: { CASH: 500, UPI: 300 },
      })
    })

    it("byMode accumulates multiple payments of same method", async () => {
      prisma.order.findMany.mockResolvedValue([
        { total: 100, subtotal: 90, gstAmount: 8, discount: 2 },
      ])
      prisma.payment.findMany.mockResolvedValue([
        { amount: 60, method: "CASH" },
        { amount: 40, method: "CASH" },
      ])

      const result = await service.getDailyPnL(RESTAURANT_ID)

      expect(result.byMode).toEqual({ CASH: 100 })
    })

    it("uses provided date string for the report date", async () => {
      prisma.order.findMany.mockResolvedValue([])
      prisma.payment.findMany.mockResolvedValue([])

      const result = await service.getDailyPnL(RESTAURANT_ID, undefined, "2026-06-15")

      expect(result.date).toBe("2026-06-15")
    })

    it("empty day → zeroed revenue fields and empty byMode", async () => {
      prisma.order.findMany.mockResolvedValue([])
      prisma.payment.findMany.mockResolvedValue([])

      const result = await service.getDailyPnL(RESTAURANT_ID)

      expect(result.revenue).toBe(0)
      expect(result.tax).toBe(0)
      expect(result.discount).toBe(0)
      expect(result.netRevenue).toBe(0)
      expect(result.orderCount).toBe(0)
      expect(result.byMode).toEqual({})
    })
  })
})
