import { NotFoundException, ForbiddenException } from "@nestjs/common"
import { InventoryService } from "./inventory.service"
import { Decimal } from "@prisma/client/runtime/library"

function makePrisma() {
  return {
    inventoryItem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    stockAdjustment: {
      create: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
    branch: {
      findUnique: jest.fn(),
    },
    menuItem: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  }
}

const RESTAURANT_ID = "rest-1"
const BRANCH_ID = "branch-1"
const ITEM_ID = "inv-1"

function makeItem(overrides: Record<string, any> = {}) {
  return {
    id: ITEM_ID,
    restaurantId: RESTAURANT_ID,
    branchId: BRANCH_ID,
    name: "Rice",
    unit: "kg",
    currentStock: new Decimal(10),
    minStock: new Decimal(5),
    costPerUnit: new Decimal(2),
    isActive: true,
    ...overrides,
  }
}

describe("InventoryService", () => {
  let service: InventoryService
  let prisma: ReturnType<typeof makePrisma>

  beforeEach(() => {
    prisma = makePrisma()
    service = new InventoryService(prisma as any)
  })

  // ── getLowStockItems ───────────────────────────────────────────────────────

  describe("getLowStockItems", () => {
    it("item with currentStock <= minStock → included in result", async () => {
      const lowItem = makeItem({ currentStock: new Decimal(3), minStock: new Decimal(5) })
      prisma.inventoryItem.findMany.mockResolvedValue([lowItem])

      const result = await service.getLowStockItems(RESTAURANT_ID, BRANCH_ID)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(ITEM_ID)
    })

    it("item with currentStock > minStock → excluded from result", async () => {
      const okItem = makeItem({ currentStock: new Decimal(10), minStock: new Decimal(5) })
      prisma.inventoryItem.findMany.mockResolvedValue([okItem])

      const result = await service.getLowStockItems(RESTAURANT_ID, BRANCH_ID)

      expect(result).toHaveLength(0)
    })

    it("result items have isLowStock: true", async () => {
      const lowItem = makeItem({ currentStock: new Decimal(5), minStock: new Decimal(5) })
      prisma.inventoryItem.findMany.mockResolvedValue([lowItem])

      const result = await service.getLowStockItems(RESTAURANT_ID, BRANCH_ID)

      expect(result[0].isLowStock).toBe(true)
    })
  })

  // ── adjustStock ────────────────────────────────────────────────────────────

  describe("adjustStock", () => {
    beforeEach(() => {
      // $transaction receives an array of Promises — resolve each one in order
      prisma.$transaction.mockImplementation((ops: Promise<any>[]) => Promise.all(ops))
    })

    it("item not found → throws NotFoundException", async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue(null)
      await expect(
        service.adjustStock(RESTAURANT_ID, ITEM_ID, "user-1", { type: "STOCK_IN", quantity: 5 } as any)
      ).rejects.toThrow(NotFoundException)
    })

    it("wrong restaurant → throws ForbiddenException", async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue(makeItem({ restaurantId: "other" }))
      await expect(
        service.adjustStock(RESTAURANT_ID, ITEM_ID, "user-1", { type: "STOCK_IN", quantity: 5 } as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("type MANUAL_DEDUCTION → delta is negative (stock decreases)", async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue(makeItem({ currentStock: new Decimal(10) }))
      prisma.inventoryItem.update.mockResolvedValue(makeItem({ currentStock: new Decimal(7) }))

      await service.adjustStock(RESTAURANT_ID, ITEM_ID, "user-1", {
        type: "MANUAL_DEDUCTION",
        quantity: 3,
      } as any)

      const txCall = prisma.$transaction.mock.calls[0][0]
      // First operation in transaction is inventoryItem.update
      // The newStock should be currentStock - quantity = 10 - 3 = 7
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ITEM_ID },
          data: expect.objectContaining({ currentStock: expect.anything() }),
        })
      )
      const updateCall = prisma.inventoryItem.update.mock.calls[0][0]
      expect(Number(updateCall.data.currentStock)).toBe(7)
    })

    it("type STOCK_IN → delta is positive (stock increases)", async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue(makeItem({ currentStock: new Decimal(10) }))
      prisma.inventoryItem.update.mockResolvedValue(makeItem({ currentStock: new Decimal(15) }))

      await service.adjustStock(RESTAURANT_ID, ITEM_ID, "user-1", {
        type: "STOCK_IN",
        quantity: 5,
      } as any)

      const updateCall = prisma.inventoryItem.update.mock.calls[0][0]
      expect(Number(updateCall.data.currentStock)).toBe(15)
    })

    it("valid → calls inventoryItem.update and creates stockAdjustment", async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue(makeItem({ currentStock: new Decimal(10) }))
      prisma.inventoryItem.update.mockResolvedValue(makeItem({ currentStock: new Decimal(15) }))

      await service.adjustStock(RESTAURANT_ID, ITEM_ID, "user-1", {
        type: "STOCK_IN",
        quantity: 5,
        note: "replenishment",
      } as any)

      expect(prisma.$transaction).toHaveBeenCalled()
      expect(prisma.stockAdjustment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inventoryItemId: ITEM_ID,
            type: "STOCK_IN",
            quantity: 5,
          }),
        })
      )
    })
  })

  // ── deductForOrder ─────────────────────────────────────────────────────────

  describe("deductForOrder", () => {
    it("order not found → returns early (no crash)", async () => {
      prisma.order.findUnique.mockResolvedValue(null)
      await expect(service.deductForOrder("order-999")).resolves.toBeUndefined()
      expect(prisma.inventoryItem.update).not.toHaveBeenCalled()
    })

    it("1 item, 1 ingredient, qty 2 at 0.5 per unit → deducts 1 unit total", async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        items: [
          {
            id: "oi-1",
            quantity: 2,
            menuItem: {
              ingredients: [
                { inventoryItemId: "inv-1", quantity: new Decimal(0.5) },
              ],
            },
          },
        ],
      })
      prisma.inventoryItem.update.mockResolvedValue({})
      prisma.stockAdjustment.create.mockResolvedValue({})

      await service.deductForOrder("order-1")

      expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-1" },
          data: { currentStock: { decrement: 1 } },
        })
      )
    })

    it("2 items sharing same ingredient → deductions are summed (not duplicate calls)", async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        items: [
          {
            id: "oi-1",
            quantity: 1,
            menuItem: {
              ingredients: [{ inventoryItemId: "inv-1", quantity: new Decimal(2) }],
            },
          },
          {
            id: "oi-2",
            quantity: 1,
            menuItem: {
              ingredients: [{ inventoryItemId: "inv-1", quantity: new Decimal(3) }],
            },
          },
        ],
      })
      prisma.inventoryItem.update.mockResolvedValue({})
      prisma.stockAdjustment.create.mockResolvedValue({})

      await service.deductForOrder("order-1")

      // Only 1 update call for inv-1, with summed qty = 5
      expect(prisma.inventoryItem.update).toHaveBeenCalledTimes(1)
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-1" },
          data: { currentStock: { decrement: 5 } },
        })
      )
    })

    it("creates stockAdjustment record for each deduction", async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        items: [
          {
            id: "oi-1",
            quantity: 1,
            menuItem: {
              ingredients: [
                { inventoryItemId: "inv-1", quantity: new Decimal(1) },
                { inventoryItemId: "inv-2", quantity: new Decimal(2) },
              ],
            },
          },
        ],
      })
      prisma.inventoryItem.update.mockResolvedValue({})
      prisma.stockAdjustment.create.mockResolvedValue({})

      await service.deductForOrder("order-1")

      expect(prisma.stockAdjustment.create).toHaveBeenCalledTimes(2)
    })
  })
})
