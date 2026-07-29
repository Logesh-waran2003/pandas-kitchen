import { NotFoundException, ForbiddenException } from "@nestjs/common"
import { KitchenService } from "./kitchen.service"

function makePrisma() {
  return {
    order: { findUnique: jest.fn() },
    kOTItem: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    kOTTicket: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    branch: { findUnique: jest.fn() },
    department: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
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
const ORDER_ID = "order-1"

describe("KitchenService", () => {
  let service: KitchenService
  let prisma: ReturnType<typeof makePrisma>
  let events: ReturnType<typeof makeEvents>

  beforeEach(() => {
    prisma = makePrisma()
    events = makeEvents()
    service = new KitchenService(prisma as any, events as any)
  })

  // ── generateKOTsForOrder ───────────────────────────────────────────────────

  describe("generateKOTsForOrder", () => {
    it("order not found → returns early, no KOT created", async () => {
      prisma.order.findUnique.mockResolvedValue(null)
      await service.generateKOTsForOrder(ORDER_ID, BRANCH_ID)
      expect(prisma.kOTItem.findMany).not.toHaveBeenCalled()
      expect(prisma.kOTTicket.create).not.toHaveBeenCalled()
    })

    it("all items already KOTted → returns early", async () => {
      const items = [
        { id: "oi-1", menuItem: { id: "mi-1", departmentId: "dept-1" } },
        { id: "oi-2", menuItem: { id: "mi-2", departmentId: "dept-1" } },
      ]
      prisma.order.findUnique.mockResolvedValue({ id: ORDER_ID, items })
      prisma.kOTItem.findMany.mockResolvedValue([
        { orderItemId: "oi-1" },
        { orderItemId: "oi-2" },
      ])
      await service.generateKOTsForOrder(ORDER_ID, BRANCH_ID)
      expect(prisma.kOTTicket.create).not.toHaveBeenCalled()
    })

    it("2 items, same departmentId → creates 1 KOT with both items, emits kot.created", async () => {
      const items = [
        { id: "oi-1", menuItem: { id: "mi-1", departmentId: "dept-1" } },
        { id: "oi-2", menuItem: { id: "mi-2", departmentId: "dept-1" } },
      ]
      prisma.order.findUnique.mockResolvedValue({ id: ORDER_ID, items })
      prisma.kOTItem.findMany.mockResolvedValue([])
      prisma.kOTTicket.create.mockResolvedValue({
        id: "kot-1",
        branchId: BRANCH_ID,
        items: [],
        order: { id: ORDER_ID, orderNumber: "ORD-001" },
      })

      await service.generateKOTsForOrder(ORDER_ID, BRANCH_ID)

      expect(prisma.kOTTicket.create).toHaveBeenCalledTimes(1)
      const createCall = prisma.kOTTicket.create.mock.calls[0][0]
      expect(createCall.data.items.create).toHaveLength(2)
      expect(events.emitToKitchen).toHaveBeenCalledWith(BRANCH_ID, "kot.created", expect.anything())
    })

    it("2 items, different departmentIds → creates 2 KOTs, emits kot.created twice", async () => {
      const items = [
        { id: "oi-1", menuItem: { id: "mi-1", departmentId: "dept-1" } },
        { id: "oi-2", menuItem: { id: "mi-2", departmentId: "dept-2" } },
      ]
      prisma.order.findUnique.mockResolvedValue({ id: ORDER_ID, items })
      prisma.kOTItem.findMany.mockResolvedValue([])
      prisma.kOTTicket.create.mockResolvedValue({
        id: "kot-1",
        branchId: BRANCH_ID,
        items: [],
        order: { id: ORDER_ID, orderNumber: "ORD-001" },
      })

      await service.generateKOTsForOrder(ORDER_ID, BRANCH_ID)

      expect(prisma.kOTTicket.create).toHaveBeenCalledTimes(2)
      expect(events.emitToKitchen).toHaveBeenCalledTimes(2)
    })

    it("items with null departmentId → grouped under 'general', departmentId set to null in KOTItem", async () => {
      const items = [
        { id: "oi-1", menuItem: { id: "mi-1", departmentId: null } },
        { id: "oi-2", menuItem: { id: "mi-2", departmentId: null } },
      ]
      prisma.order.findUnique.mockResolvedValue({ id: ORDER_ID, items })
      prisma.kOTItem.findMany.mockResolvedValue([])
      prisma.kOTTicket.create.mockResolvedValue({
        id: "kot-1",
        branchId: BRANCH_ID,
        items: [],
        order: { id: ORDER_ID, orderNumber: "ORD-001" },
      })

      await service.generateKOTsForOrder(ORDER_ID, BRANCH_ID)

      // Only 1 KOT for the "general" bucket
      expect(prisma.kOTTicket.create).toHaveBeenCalledTimes(1)
      const createCall = prisma.kOTTicket.create.mock.calls[0][0]
      const kotItems = createCall.data.items.create
      expect(kotItems).toHaveLength(2)
      kotItems.forEach((i: any) => expect(i.departmentId).toBeNull())
    })
  })

  // ── updateKOTStatus ────────────────────────────────────────────────────────

  describe("updateKOTStatus", () => {
    it("ticket not found → throws NotFoundException", async () => {
      prisma.kOTTicket.findUnique.mockResolvedValue(null)
      await expect(
        service.updateKOTStatus(RESTAURANT_ID, "kot-99", { status: "DONE" } as any)
      ).rejects.toThrow(NotFoundException)
    })

    it("branch restaurantId mismatch → throws ForbiddenException", async () => {
      prisma.kOTTicket.findUnique.mockResolvedValue({ id: "kot-1", branchId: BRANCH_ID })
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID, restaurantId: "other-rest" })
      await expect(
        service.updateKOTStatus(RESTAURANT_ID, "kot-1", { status: "DONE" } as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("valid → updates status, emits kot.status_changed", async () => {
      prisma.kOTTicket.findUnique.mockResolvedValue({ id: "kot-1", branchId: BRANCH_ID })
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID, restaurantId: RESTAURANT_ID })
      prisma.kOTTicket.update.mockResolvedValue({ id: "kot-1", branchId: BRANCH_ID, status: "DONE" })

      await service.updateKOTStatus(RESTAURANT_ID, "kot-1", { status: "DONE" } as any)

      expect(prisma.kOTTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "kot-1" }, data: { status: "DONE" } })
      )
      expect(events.emitToKitchen).toHaveBeenCalledWith(
        BRANCH_ID, "kot.status_changed", expect.objectContaining({ status: "DONE" })
      )
    })
  })

  // ── updateKOTItemStatus ────────────────────────────────────────────────────

  describe("updateKOTItemStatus", () => {
    const baseItem = {
      id: "ki-1",
      kotTicketId: "kot-1",
      kotTicket: {
        branchId: BRANCH_ID,
        branch: { restaurantId: RESTAURANT_ID },
      },
    }

    it("item not found → throws NotFoundException", async () => {
      prisma.kOTItem.findUnique.mockResolvedValue(null)
      await expect(
        service.updateKOTItemStatus(RESTAURANT_ID, "ki-99", { status: "PREPARING" } as any)
      ).rejects.toThrow(NotFoundException)
    })

    it("branch restaurantId mismatch → throws ForbiddenException", async () => {
      prisma.kOTItem.findUnique.mockResolvedValue({
        ...baseItem,
        kotTicket: { branchId: BRANCH_ID, branch: { restaurantId: "other-rest" } },
      })
      await expect(
        service.updateKOTItemStatus(RESTAURANT_ID, "ki-1", { status: "PREPARING" } as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("status PREPARING → sets startedAt on update data", async () => {
      prisma.kOTItem.findUnique.mockResolvedValue(baseItem)
      prisma.kOTItem.update.mockResolvedValue({ ...baseItem, status: "PREPARING", kotTicketId: "kot-1" })

      await service.updateKOTItemStatus(RESTAURANT_ID, "ki-1", { status: "PREPARING" } as any)

      const updateCall = prisma.kOTItem.update.mock.calls[0][0]
      expect(updateCall.data.startedAt).toBeInstanceOf(Date)
      expect(updateCall.data.completedAt).toBeUndefined()
    })

    it("status DONE → sets completedAt on update data", async () => {
      prisma.kOTItem.findUnique.mockResolvedValue(baseItem)
      prisma.kOTItem.update.mockResolvedValue({ ...baseItem, status: "DONE", kotTicketId: "kot-1" })

      await service.updateKOTItemStatus(RESTAURANT_ID, "ki-1", { status: "DONE" } as any)

      const updateCall = prisma.kOTItem.update.mock.calls[0][0]
      expect(updateCall.data.completedAt).toBeInstanceOf(Date)
      expect(updateCall.data.startedAt).toBeUndefined()
    })

    it("emits kot.item_updated with kotId, itemId, status", async () => {
      prisma.kOTItem.findUnique.mockResolvedValue(baseItem)
      prisma.kOTItem.update.mockResolvedValue({ id: "ki-1", kotTicketId: "kot-1", status: "DONE" })

      await service.updateKOTItemStatus(RESTAURANT_ID, "ki-1", { status: "DONE" } as any)

      expect(events.emitToKitchen).toHaveBeenCalledWith(
        BRANCH_ID,
        "kot.item_updated",
        expect.objectContaining({ kotId: "kot-1", itemId: "ki-1", status: "DONE" })
      )
    })
  })

  // ── createDepartment ───────────────────────────────────────────────────────

  describe("createDepartment", () => {
    it("branch not found → throws ForbiddenException", async () => {
      prisma.branch.findUnique.mockResolvedValue(null)
      await expect(
        service.createDepartment(RESTAURANT_ID, { branchId: BRANCH_ID, name: "Grill" } as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("branch belongs to different restaurant → throws ForbiddenException", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID, restaurantId: "other-rest" })
      await expect(
        service.createDepartment(RESTAURANT_ID, { branchId: BRANCH_ID, name: "Grill" } as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("valid → calls department.create with correct data", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID, restaurantId: RESTAURANT_ID })
      prisma.department.create.mockResolvedValue({ id: "dept-1", name: "Grill" })

      await service.createDepartment(RESTAURANT_ID, { branchId: BRANCH_ID, name: "Grill" } as any)

      expect(prisma.department.create).toHaveBeenCalledWith({
        data: { restaurantId: RESTAURANT_ID, branchId: BRANCH_ID, name: "Grill" },
      })
    })
  })
})
