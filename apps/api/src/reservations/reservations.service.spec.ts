import { NotFoundException, ForbiddenException } from "@nestjs/common"
import { ReservationsService } from "./reservations.service"

function makePrisma() {
  return {
    branch: { findUnique: jest.fn() },
    reservation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }
}

function makeEvents() {
  return {
    emitToBranch: jest.fn(),
    emitToOrder: jest.fn(),
    emitToKitchen: jest.fn(),
    emitToRoom: jest.fn(),
  }
}

const RESTAURANT_ID = "rest-1"
const BRANCH_ID = "branch-1"
const RESERVATION_ID = "res-1"

function makeReservation(overrides: Record<string, any> = {}) {
  return {
    id: RESERVATION_ID,
    restaurantId: RESTAURANT_ID,
    branchId: BRANCH_ID,
    tableId: null,
    customerName: "Ravi",
    phone: "9999999999",
    partySize: 4,
    date: new Date("2026-08-01T19:00:00Z"),
    status: "PENDING",
    notes: null,
    branch: { id: BRANCH_ID, name: "Main" },
    table: null,
    ...overrides,
  }
}

describe("ReservationsService", () => {
  let service: ReservationsService
  let prisma: ReturnType<typeof makePrisma>
  let events: ReturnType<typeof makeEvents>

  beforeEach(() => {
    prisma = makePrisma()
    events = makeEvents()
    service = new ReservationsService(prisma as any, events as any)
  })

  // ── createReservation ──────────────────────────────────────────────────────

  describe("createReservation", () => {
    const dto = {
      branchId: BRANCH_ID,
      customerName: "Ravi",
      phone: "9999999999",
      partySize: 4,
      date: "2026-08-01T19:00:00Z",
    }

    it("branch not found → throws ForbiddenException", async () => {
      prisma.branch.findUnique.mockResolvedValue(null)
      await expect(
        service.createReservation(RESTAURANT_ID, dto as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("branch belongs to different restaurant → throws ForbiddenException", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID, restaurantId: "other" })
      await expect(
        service.createReservation(RESTAURANT_ID, dto as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("valid → calls reservation.create with date as Date object, not string", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID, restaurantId: RESTAURANT_ID })
      prisma.reservation.create.mockResolvedValue(makeReservation())

      await service.createReservation(RESTAURANT_ID, dto as any)

      expect(prisma.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            restaurantId: RESTAURANT_ID,
            branchId: BRANCH_ID,
            customerName: "Ravi",
            date: expect.any(Date),
          }),
        })
      )
    })
  })

  // ── getReservation ─────────────────────────────────────────────────────────

  describe("getReservation", () => {
    it("not found → throws NotFoundException", async () => {
      prisma.reservation.findUnique.mockResolvedValue(null)
      await expect(
        service.getReservation(RESTAURANT_ID, RESERVATION_ID)
      ).rejects.toThrow(NotFoundException)
    })

    it("wrong restaurant → throws ForbiddenException", async () => {
      prisma.reservation.findUnique.mockResolvedValue(makeReservation({ restaurantId: "other" }))
      await expect(
        service.getReservation(RESTAURANT_ID, RESERVATION_ID)
      ).rejects.toThrow(ForbiddenException)
    })

    it("valid → returns reservation with branch and table includes", async () => {
      const reservation = makeReservation()
      prisma.reservation.findUnique.mockResolvedValue(reservation)

      const result = await service.getReservation(RESTAURANT_ID, RESERVATION_ID)

      expect(result.id).toBe(RESERVATION_ID)
      expect(result.branch).toBeDefined()
    })
  })

  // ── updateReservation ──────────────────────────────────────────────────────

  describe("updateReservation", () => {
    it("not found → throws NotFoundException", async () => {
      prisma.reservation.findUnique.mockResolvedValue(null)
      await expect(
        service.updateReservation(RESTAURANT_ID, RESERVATION_ID, { status: "CONFIRMED" } as any)
      ).rejects.toThrow(NotFoundException)
    })

    it("wrong restaurant → throws ForbiddenException", async () => {
      prisma.reservation.findUnique.mockResolvedValue(makeReservation({ restaurantId: "other" }))
      await expect(
        service.updateReservation(RESTAURANT_ID, RESERVATION_ID, { status: "CONFIRMED" } as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("status change to SEATED → calls reservation.update, emits reservation.seated event", async () => {
      prisma.reservation.findUnique.mockResolvedValue(makeReservation())
      prisma.reservation.update.mockResolvedValue(makeReservation({ status: "SEATED" }))

      await service.updateReservation(RESTAURANT_ID, RESERVATION_ID, { status: "SEATED" } as any)

      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: RESERVATION_ID },
          data: expect.objectContaining({ status: "SEATED" }),
        })
      )
      expect(events.emitToRoom).toHaveBeenCalledWith(
        `branch:${BRANCH_ID}`,
        "reservation.seated",
        expect.objectContaining({ reservationId: RESERVATION_ID })
      )
    })

    it("status change to CONFIRMED → updates but does NOT emit seated event", async () => {
      prisma.reservation.findUnique.mockResolvedValue(makeReservation())
      prisma.reservation.update.mockResolvedValue(makeReservation({ status: "CONFIRMED" }))

      await service.updateReservation(RESTAURANT_ID, RESERVATION_ID, { status: "CONFIRMED" } as any)

      expect(prisma.reservation.update).toHaveBeenCalled()
      expect(events.emitToRoom).not.toHaveBeenCalled()
    })
  })

  // ── deleteReservation ──────────────────────────────────────────────────────

  describe("deleteReservation", () => {
    it("not found → throws NotFoundException", async () => {
      prisma.reservation.findUnique.mockResolvedValue(null)
      await expect(
        service.deleteReservation(RESTAURANT_ID, RESERVATION_ID)
      ).rejects.toThrow(NotFoundException)
    })

    it("wrong restaurant → throws ForbiddenException", async () => {
      prisma.reservation.findUnique.mockResolvedValue(makeReservation({ restaurantId: "other" }))
      await expect(
        service.deleteReservation(RESTAURANT_ID, RESERVATION_ID)
      ).rejects.toThrow(ForbiddenException)
    })

    it("valid → deletes reservation, returns { success: true }", async () => {
      prisma.reservation.findUnique.mockResolvedValue(makeReservation())
      prisma.reservation.delete.mockResolvedValue(makeReservation())

      const result = await service.deleteReservation(RESTAURANT_ID, RESERVATION_ID)

      expect(prisma.reservation.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: RESERVATION_ID } })
      )
      expect(result).toEqual({ success: true })
    })
  })
})
