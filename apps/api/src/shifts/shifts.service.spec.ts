import { NotFoundException, ForbiddenException, ConflictException } from "@nestjs/common"
import { ShiftsService } from "./shifts.service"
import { Decimal } from "@prisma/client/runtime/library"

function makePrisma() {
  return {
    branch: { findUnique: jest.fn() },
    shift: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    payment: { findMany: jest.fn() },
    order: { count: jest.fn() },
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
const SHIFT_ID = "shift-1"
const USER_ID = "user-1"

function makeShift(overrides: Record<string, any> = {}) {
  return {
    id: SHIFT_ID,
    restaurantId: RESTAURANT_ID,
    branchId: BRANCH_ID,
    status: "OPEN",
    openingFloat: new Decimal(500),
    closingFloat: null,
    openedAt: new Date(),
    closedAt: null,
    openedBy: { id: USER_ID, name: "Chef" },
    closedBy: null,
    notes: null,
    ...overrides,
  }
}

describe("ShiftsService", () => {
  let service: ShiftsService
  let prisma: ReturnType<typeof makePrisma>
  let events: ReturnType<typeof makeEvents>

  beforeEach(() => {
    prisma = makePrisma()
    events = makeEvents()
    service = new ShiftsService(prisma as any, events as any)
  })

  // ── openShift ──────────────────────────────────────────────────────────────

  describe("openShift", () => {
    it("branch not found → throws ForbiddenException", async () => {
      prisma.branch.findUnique.mockResolvedValue(null)
      await expect(
        service.openShift(RESTAURANT_ID, USER_ID, { branchId: BRANCH_ID } as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("branch belongs to different restaurant → throws ForbiddenException", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID, restaurantId: "other" })
      await expect(
        service.openShift(RESTAURANT_ID, USER_ID, { branchId: BRANCH_ID } as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("shift already open → throws ConflictException", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID, restaurantId: RESTAURANT_ID })
      prisma.shift.findFirst.mockResolvedValue(makeShift())

      await expect(
        service.openShift(RESTAURANT_ID, USER_ID, { branchId: BRANCH_ID, openingFloat: 500 } as any)
      ).rejects.toThrow(ConflictException)
    })

    it("valid → calls shift.create, emits shift.opened event", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID, restaurantId: RESTAURANT_ID })
      prisma.shift.findFirst.mockResolvedValue(null)
      prisma.shift.create.mockResolvedValue(makeShift())

      await service.openShift(RESTAURANT_ID, USER_ID, { branchId: BRANCH_ID, openingFloat: 500 } as any)

      expect(prisma.shift.create).toHaveBeenCalled()
      expect(events.emitToBranch).toHaveBeenCalledWith(
        BRANCH_ID, "shift.opened", expect.objectContaining({ id: SHIFT_ID })
      )
    })
  })

  // ── closeShift ─────────────────────────────────────────────────────────────

  describe("closeShift", () => {
    beforeEach(() => {
      prisma.payment.findMany.mockResolvedValue([])
    })

    it("shift not found → throws NotFoundException", async () => {
      prisma.shift.findUnique.mockResolvedValue(null)
      await expect(
        service.closeShift(RESTAURANT_ID, USER_ID, "shift-99", {} as any)
      ).rejects.toThrow(NotFoundException)
    })

    it("wrong restaurant → throws ForbiddenException", async () => {
      prisma.shift.findUnique.mockResolvedValue(makeShift({ restaurantId: "other" }))
      await expect(
        service.closeShift(RESTAURANT_ID, USER_ID, SHIFT_ID, {} as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("already closed → throws ConflictException", async () => {
      prisma.shift.findUnique.mockResolvedValue(makeShift({ status: "CLOSED" }))
      await expect(
        service.closeShift(RESTAURANT_ID, USER_ID, SHIFT_ID, {} as any)
      ).rejects.toThrow(ConflictException)
    })

    it("valid → calls shift.update with closedAt, closedById, emits shift.closed event", async () => {
      prisma.shift.findUnique.mockResolvedValue(makeShift())
      prisma.shift.update.mockResolvedValue(makeShift({ status: "CLOSED", closedAt: new Date() }))

      await service.closeShift(RESTAURANT_ID, USER_ID, SHIFT_ID, { closingFloat: 480 } as any)

      expect(prisma.shift.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SHIFT_ID },
          data: expect.objectContaining({
            status: "CLOSED",
            closedById: USER_ID,
            closedAt: expect.any(Date),
          }),
        })
      )
      expect(events.emitToBranch).toHaveBeenCalledWith(
        BRANCH_ID, "shift.closed", expect.objectContaining({ id: SHIFT_ID })
      )
    })
  })

  // ── getActiveShift ─────────────────────────────────────────────────────────

  describe("getActiveShift", () => {
    it("no open shift → returns null", async () => {
      prisma.shift.findFirst.mockResolvedValue(null)
      const result = await service.getActiveShift(RESTAURANT_ID, BRANCH_ID)
      expect(result).toBeNull()
    })

    it("open shift found → returns serialized shift with openingFloat as number", async () => {
      prisma.shift.findFirst.mockResolvedValue(makeShift({ openingFloat: new Decimal(500) }))

      const result = await service.getActiveShift(RESTAURANT_ID, BRANCH_ID)

      expect(result).not.toBeNull()
      expect(typeof result!.openingFloat).toBe("number")
      expect(result!.openingFloat).toBe(500)
    })
  })
})
