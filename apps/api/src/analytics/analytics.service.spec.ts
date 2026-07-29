import { AnalyticsService } from "./analytics.service"
import { Decimal } from "@prisma/client/runtime/library"

function makePrisma() {
  return {
    order: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    table: {
      count: jest.fn(),
    },
    customer: {
      count: jest.fn(),
    },
  }
}

const RESTAURANT_ID = "rest-1"

describe("AnalyticsService", () => {
  let service: AnalyticsService
  let prisma: ReturnType<typeof makePrisma>

  beforeEach(() => {
    prisma = makePrisma()
    service = new AnalyticsService(prisma as any)
  })

  describe("getSummary", () => {
    function setupDefaults() {
      prisma.order.count.mockResolvedValue(0)
      prisma.table.count.mockResolvedValue(0)
      prisma.customer.count.mockResolvedValue(0)
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: new Decimal(0) } })
    }

    it("totalCustomers uses prisma.customer.count, not user model", async () => {
      setupDefaults()
      prisma.customer.count.mockResolvedValue(42)

      const result = await service.getSummary(RESTAURANT_ID)

      expect(result.totalCustomers).toBe(42)
      expect(prisma.customer.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { restaurantId: RESTAURANT_ID, isActive: true } })
      )
    })

    it("cancelled orders excluded from revenue — order.aggregate where clause has status not CANCELLED", async () => {
      setupDefaults()
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: new Decimal(500) } })

      const result = await service.getSummary(RESTAURANT_ID)

      // Both aggregate calls (total revenue + today revenue) should exclude cancelled
      const aggregateCalls = prisma.order.aggregate.mock.calls
      for (const [args] of aggregateCalls) {
        expect(args.where).toMatchObject({
          restaurantId: RESTAURANT_ID,
          status: { not: "CANCELLED" },
        })
      }

      expect(result.totalRevenue).toBe(500)
    })

    it("cancelled orders excluded from order count — order.count where clause has status not CANCELLED", async () => {
      setupDefaults()
      prisma.order.count.mockResolvedValue(7)

      await service.getSummary(RESTAURANT_ID)

      const countCalls = prisma.order.count.mock.calls
      for (const [args] of countCalls) {
        expect(args.where).toMatchObject({
          status: { not: "CANCELLED" },
        })
      }
    })

    it("returns correct shape with aggregated values", async () => {
      prisma.order.count
        .mockResolvedValueOnce(10)  // totalOrders
        .mockResolvedValueOnce(3)   // todayOrders
      prisma.table.count.mockResolvedValue(5)
      prisma.customer.count.mockResolvedValue(20)
      prisma.order.aggregate
        .mockResolvedValueOnce({ _sum: { total: new Decimal(1000) } })  // totalRevenue
        .mockResolvedValueOnce({ _sum: { total: new Decimal(250) } })   // todayRevenue

      const result = await service.getSummary(RESTAURANT_ID)

      expect(result).toMatchObject({
        totalOrders: 10,
        totalTables: 5,
        totalCustomers: 20,
        totalRevenue: 1000,
        todayOrders: 3,
        todayRevenue: 250,
      })
    })
  })
})
