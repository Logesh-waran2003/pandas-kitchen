import { NotFoundException, BadRequestException } from "@nestjs/common"
import { OrdersService } from "./orders.service"
import { Decimal } from "@prisma/client/runtime/library"

function makeEventGateway() {
  return { emitToBranch: jest.fn(), emitToOrder: jest.fn() }
}

function makeTx() {
  return {
    order: { create: jest.fn(), update: jest.fn() },
    customer: { update: jest.fn() },
  }
}

function makePrisma(tx: ReturnType<typeof makeTx>) {
  return {
    branch: { findUnique: jest.fn() },
    customer: { findUnique: jest.fn() },
    menuItem: { findMany: jest.fn() },
    menuItemVariant: { findMany: jest.fn() },
    menuAddon: { findMany: jest.fn() },
    order: { findUnique: jest.fn() },
    $transaction: jest.fn().mockImplementation((cb: (tx: any) => any) => cb(tx)),
  }
}

const RESTAURANT_ID = "rest-1"
const BRANCH_ID = "branch-1"
const MENU_ITEM_ID_1 = "item-1"
const MENU_ITEM_ID_2 = "item-2"

function makeMenuItem(id: string, price: number) {
  return { id, restaurantId: RESTAURANT_ID, price: new Decimal(price) }
}

function makeOrderResult(overrides: Record<string, any> = {}) {
  return {
    id: "order-1",
    orderNumber: "ORD-TEST",
    status: "PENDING",
    orderType: "DINE_IN",
    restaurantId: RESTAURANT_ID,
    branchId: BRANCH_ID,
    tableId: null,
    customerId: null,
    subtotal: new Decimal(200),
    tax: new Decimal(10),
    discount: new Decimal(0),
    discountType: "FLAT",
    serviceCharge: new Decimal(0),
    gstRate: new Decimal(5),
    gstAmount: new Decimal(10),
    total: new Decimal(210),
    paymentStatus: "UNPAID",
    createdById: null,
    table: null,
    branch: { id: BRANCH_ID, name: "Main" },
    customer: null,
    items: [],
    payments: [],
    ...overrides,
  }
}

function makeInventoryService() {
  return { deductForOrder: jest.fn().mockResolvedValue(undefined) }
}

describe("OrdersService", () => {
  let service: OrdersService
  let prisma: ReturnType<typeof makePrisma>
  let tx: ReturnType<typeof makeTx>
  let events: ReturnType<typeof makeEventGateway>

  beforeEach(() => {
    tx = makeTx()
    prisma = makePrisma(tx)
    events = makeEventGateway()
    service = new OrdersService(prisma as any, events as any, makeInventoryService() as any, { generateKOTsForOrder: jest.fn().mockResolvedValue(undefined) } as any)
  })

  function setupBranchAndItems(items: Array<{ id: string; price: number }>) {
    prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID, restaurantId: RESTAURANT_ID, isActive: true })
    prisma.menuItem.findMany.mockResolvedValue(items.map(({ id, price }) => makeMenuItem(id, price)))
    prisma.menuItemVariant.findMany.mockResolvedValue([])
    prisma.menuAddon.findMany.mockResolvedValue([])
  }

  // ── createOrder ───────────────────────────────────────────────────────────

  describe("createOrder", () => {
    it("2 items at 100 each, no discount, 5% GST → subtotal=200, gstAmount=10, total=210", async () => {
      setupBranchAndItems([
        { id: MENU_ITEM_ID_1, price: 100 },
        { id: MENU_ITEM_ID_2, price: 100 },
      ])

      const expectedResult = makeOrderResult()
      tx.order.create.mockResolvedValue(expectedResult)

      const dto = {
        branchId: BRANCH_ID,
        items: [
          { menuItemId: MENU_ITEM_ID_1, quantity: 1, addonIds: [] },
          { menuItemId: MENU_ITEM_ID_2, quantity: 1, addonIds: [] },
        ],
        gstRate: 5,
      }

      const result = await service.createOrder(RESTAURANT_ID, "user-1", dto as any)

      // The tx.order.create is called with the computed values
      const createCall = tx.order.create.mock.calls[0][0]
      expect(Number(createCall.data.subtotal)).toBeCloseTo(200, 2)
      expect(Number(createCall.data.gstAmount)).toBeCloseTo(10, 2)
      expect(Number(createCall.data.total)).toBeCloseTo(210, 2)
    })

    it("flat discount 10 → total = 190 * 1.05 = 199.50", async () => {
      setupBranchAndItems([
        { id: MENU_ITEM_ID_1, price: 100 },
        { id: MENU_ITEM_ID_2, price: 100 },
      ])
      tx.order.create.mockResolvedValue(makeOrderResult({ total: new Decimal(199.5) }))

      const dto = {
        branchId: BRANCH_ID,
        discount: 10,
        discountType: "FLAT",
        gstRate: 5,
        items: [
          { menuItemId: MENU_ITEM_ID_1, quantity: 1, addonIds: [] },
          { menuItemId: MENU_ITEM_ID_2, quantity: 1, addonIds: [] },
        ],
      }

      await service.createOrder(RESTAURANT_ID, "user-1", dto as any)

      const createCall = tx.order.create.mock.calls[0][0]
      expect(Number(createCall.data.discount)).toBeCloseTo(10, 2)
      expect(Number(createCall.data.total)).toBeCloseTo(199.5, 2)
    })

    it("percent discount 10% → discountAmt=20, total = 180 * 1.05 = 189", async () => {
      setupBranchAndItems([
        { id: MENU_ITEM_ID_1, price: 100 },
        { id: MENU_ITEM_ID_2, price: 100 },
      ])
      tx.order.create.mockResolvedValue(makeOrderResult({ total: new Decimal(189) }))

      const dto = {
        branchId: BRANCH_ID,
        discount: 10,
        discountType: "PERCENT",
        gstRate: 5,
        items: [
          { menuItemId: MENU_ITEM_ID_1, quantity: 1, addonIds: [] },
          { menuItemId: MENU_ITEM_ID_2, quantity: 1, addonIds: [] },
        ],
      }

      await service.createOrder(RESTAURANT_ID, "user-1", dto as any)

      const createCall = tx.order.create.mock.calls[0][0]
      expect(Number(createCall.data.discount)).toBeCloseTo(20, 2)
      expect(Number(createCall.data.total)).toBeCloseTo(189, 2)
    })

    it("GST 5% on subtotal 200 → gstAmount = 10", async () => {
      setupBranchAndItems([{ id: MENU_ITEM_ID_1, price: 200 }])
      tx.order.create.mockResolvedValue(makeOrderResult({ subtotal: new Decimal(200), gstAmount: new Decimal(10), total: new Decimal(210) }))

      const dto = {
        branchId: BRANCH_ID,
        gstRate: 5,
        items: [{ menuItemId: MENU_ITEM_ID_1, quantity: 1, addonIds: [] }],
      }

      await service.createOrder(RESTAURANT_ID, "user-1", dto as any)

      const createCall = tx.order.create.mock.calls[0][0]
      expect(Number(createCall.data.gstAmount)).toBeCloseTo(10, 2)
    })

    it("with customerId → customer.update called with totalOrders increment and totalSpent increment", async () => {
      const CUSTOMER_ID = "cust-1"
      prisma.customer.findUnique.mockResolvedValue({ id: CUSTOMER_ID, restaurantId: RESTAURANT_ID })
      setupBranchAndItems([{ id: MENU_ITEM_ID_1, price: 100 }])
      tx.order.create.mockResolvedValue(makeOrderResult({ customerId: CUSTOMER_ID, total: new Decimal(105) }))
      tx.customer.update.mockResolvedValue({})

      const dto = {
        branchId: BRANCH_ID,
        customerId: CUSTOMER_ID,
        gstRate: 5,
        items: [{ menuItemId: MENU_ITEM_ID_1, quantity: 1, addonIds: [] }],
      }

      await service.createOrder(RESTAURANT_ID, "user-1", dto as any)

      expect(tx.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CUSTOMER_ID },
          data: expect.objectContaining({
            totalOrders: { increment: 1 },
          }),
        })
      )
    })

    it("invalid menuItemId (not in DB) → throws NotFoundException", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID, restaurantId: RESTAURANT_ID, isActive: true })
      // menuItem.findMany returns empty — the requested item doesn't exist
      prisma.menuItem.findMany.mockResolvedValue([])
      prisma.menuItemVariant.findMany.mockResolvedValue([])
      prisma.menuAddon.findMany.mockResolvedValue([])

      const dto = {
        branchId: BRANCH_ID,
        gstRate: 5,
        items: [{ menuItemId: "nonexistent-id", quantity: 1, addonIds: [] }],
      }

      await expect(
        service.createOrder(RESTAURANT_ID, "user-1", dto as any)
      ).rejects.toThrow(NotFoundException)
    })
  })
})
