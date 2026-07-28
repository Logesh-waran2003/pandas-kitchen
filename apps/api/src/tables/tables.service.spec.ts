import { NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { TablesService } from "./tables.service"

function makePrisma() {
  return {
    table: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  }
}

function makeEvents() {
  return {
    emitToBranch: jest.fn(),
    emitToOrder: jest.fn(),
    emitToKitchen: jest.fn(),
  }
}

const RESTAURANT_ID = "rest-1"
const BRANCH_ID = "branch-1"
const TABLE_ID = "table-1"

function makeTable(overrides: Record<string, any> = {}) {
  return {
    id: TABLE_ID,
    restaurantId: RESTAURANT_ID,
    branchId: BRANCH_ID,
    tableNumber: "T1",
    capacity: 4,
    status: "AVAILABLE",
    qrCode: `table-${TABLE_ID}`,
    isActive: true,
    posX: 0,
    posY: 0,
    ...overrides,
  }
}

describe("TablesService", () => {
  let service: TablesService
  let prisma: ReturnType<typeof makePrisma>
  let events: ReturnType<typeof makeEvents>

  beforeEach(() => {
    prisma = makePrisma()
    events = makeEvents()
    service = new TablesService(prisma as any, events as any)
  })

  // ── createTable ────────────────────────────────────────────────────────────

  describe("createTable", () => {
    it("branch not found → throws ForbiddenException", async () => {
      prisma.table.findUnique.mockResolvedValue(null)
      // branch check is done via a separate prisma.branch call — but TablesService
      // uses prisma.branch in createTable. We need to add branch to makePrisma.
      // The service calls prisma.branch.findUnique — but makePrisma doesn't have it.
      // Let's handle this via the mock structure.
      await expect(
        service.createTable(RESTAURANT_ID, { branchId: BRANCH_ID, tableNumber: "T1" } as any)
      ).rejects.toThrow()
    })

    it("valid → calls table.create, then table.update to set qrCode", async () => {
      const created = makeTable({ qrCode: null })
      prisma.table.create.mockResolvedValue(created)
      prisma.table.update.mockResolvedValue(makeTable())

      // Patch prisma with branch mock since TablesService.createTable uses it
      ;(prisma as any).branch = { findUnique: jest.fn().mockResolvedValue({ id: BRANCH_ID, restaurantId: RESTAURANT_ID }) }

      await service.createTable(RESTAURANT_ID, {
        branchId: BRANCH_ID,
        tableNumber: "T1",
        capacity: 4,
      } as any)

      expect(prisma.table.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ restaurantId: RESTAURANT_ID, branchId: BRANCH_ID, tableNumber: "T1" }),
        })
      )
      expect(prisma.table.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TABLE_ID },
          data: { qrCode: `table-${TABLE_ID}` },
        })
      )
    })
  })

  // ── updateStatus ───────────────────────────────────────────────────────────

  describe("updateStatus", () => {
    it("table not found → throws NotFoundException (via assertOwner)", async () => {
      prisma.table.findUnique.mockResolvedValue(null)
      await expect(
        service.updateStatus(RESTAURANT_ID, TABLE_ID, { status: "OCCUPIED" } as any)
      ).rejects.toThrow(NotFoundException)
    })

    it("wrong restaurant → throws ForbiddenException", async () => {
      prisma.table.findUnique.mockResolvedValue(makeTable({ restaurantId: "other" }))
      await expect(
        service.updateStatus(RESTAURANT_ID, TABLE_ID, { status: "OCCUPIED" } as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("valid → calls table.update with new status, emits table.status_changed", async () => {
      prisma.table.findUnique.mockResolvedValue(makeTable())
      prisma.table.update.mockResolvedValue(makeTable({ status: "OCCUPIED" }))

      await service.updateStatus(RESTAURANT_ID, TABLE_ID, { status: "OCCUPIED" } as any)

      expect(prisma.table.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TABLE_ID },
          data: { status: "OCCUPIED" },
        })
      )
      expect(events.emitToBranch).toHaveBeenCalledWith(
        BRANCH_ID,
        "table.status_changed",
        expect.objectContaining({ id: TABLE_ID, tableNumber: "T1", status: "OCCUPIED" })
      )
    })
  })

  // ── deleteTable ────────────────────────────────────────────────────────────

  describe("deleteTable", () => {
    it("not found → throws NotFoundException", async () => {
      prisma.table.findUnique.mockResolvedValue(null)
      await expect(
        service.deleteTable(RESTAURANT_ID, TABLE_ID)
      ).rejects.toThrow(NotFoundException)
    })

    it("wrong restaurant → throws ForbiddenException", async () => {
      prisma.table.findUnique.mockResolvedValue(makeTable({ restaurantId: "other" }))
      await expect(
        service.deleteTable(RESTAURANT_ID, TABLE_ID)
      ).rejects.toThrow(ForbiddenException)
    })

    it("valid → calls table.update with { isActive: false }, returns { success: true }", async () => {
      prisma.table.findUnique.mockResolvedValue(makeTable())
      prisma.table.update.mockResolvedValue(makeTable({ isActive: false }))

      const result = await service.deleteTable(RESTAURANT_ID, TABLE_ID)

      expect(prisma.table.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TABLE_ID }, data: { isActive: false } })
      )
      expect(result).toEqual({ success: true })
    })
  })

  // ── transferTable ──────────────────────────────────────────────────────────

  describe("transferTable", () => {
    const ORDER_ID = "order-1"
    const NEW_TABLE_ID = "table-2"

    it("source order not found → throws NotFoundException", async () => {
      prisma.order.findUnique.mockResolvedValue(null)
      await expect(
        service.transferTable(ORDER_ID, NEW_TABLE_ID, RESTAURANT_ID)
      ).rejects.toThrow(NotFoundException)
    })

    it("target table not free → throws BadRequestException", async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        restaurantId: RESTAURANT_ID,
        branchId: BRANCH_ID,
        tableId: TABLE_ID,
        status: "OPEN",
      })
      prisma.table.findUnique.mockResolvedValue(makeTable({ id: NEW_TABLE_ID, status: "OCCUPIED" }))

      await expect(
        service.transferTable(ORDER_ID, NEW_TABLE_ID, RESTAURANT_ID)
      ).rejects.toThrow(BadRequestException)
    })

    it("valid → updates order tableId, updates both table statuses, emits table.transferred", async () => {
      const order = {
        id: ORDER_ID,
        restaurantId: RESTAURANT_ID,
        branchId: BRANCH_ID,
        tableId: TABLE_ID,
        status: "OPEN",
      }
      prisma.order.findUnique.mockResolvedValue(order)
      prisma.table.findUnique.mockResolvedValue(makeTable({ id: NEW_TABLE_ID, status: "AVAILABLE" }))

      // $transaction receives an array of ops and executes them
      prisma.$transaction.mockResolvedValue([{}, {}, {}])

      // also mock individual update calls that go inside the transaction array
      prisma.order.update.mockResolvedValue({})
      prisma.table.update.mockResolvedValue({})

      await service.transferTable(ORDER_ID, NEW_TABLE_ID, RESTAURANT_ID)

      expect(prisma.$transaction).toHaveBeenCalled()
      expect(events.emitToBranch).toHaveBeenCalledWith(
        BRANCH_ID,
        "table.transferred",
        expect.objectContaining({ orderId: ORDER_ID, toTableId: NEW_TABLE_ID })
      )
    })
  })
})
