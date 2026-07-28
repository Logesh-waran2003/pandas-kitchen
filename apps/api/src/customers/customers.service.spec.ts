import { NotFoundException, ForbiddenException, ConflictException } from "@nestjs/common"
import { CustomersService } from "./customers.service"
import { Decimal } from "@prisma/client/runtime/library"

function makePrisma() {
  return {
    customer: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
  }
}

const RESTAURANT_ID = "rest-1"
const CUSTOMER_ID = "cust-1"

function makeCustomer(overrides: Record<string, any> = {}) {
  return {
    id: CUSTOMER_ID,
    restaurantId: RESTAURANT_ID,
    name: "Ravi",
    phone: "9999999999",
    email: null,
    totalSpent: new Decimal(500),
    totalOrders: 5,
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  }
}

describe("CustomersService", () => {
  let service: CustomersService
  let prisma: ReturnType<typeof makePrisma>

  beforeEach(() => {
    prisma = makePrisma()
    service = new CustomersService(prisma as any)
  })

  // ── getCustomerOrders ──────────────────────────────────────────────────────

  describe("getCustomerOrders", () => {
    it("customer not found → throws NotFoundException", async () => {
      prisma.customer.findUnique.mockResolvedValue(null)
      await expect(
        service.getCustomerOrders(RESTAURANT_ID, CUSTOMER_ID)
      ).rejects.toThrow(NotFoundException)
    })

    it("customer belongs to different restaurant → throws ForbiddenException", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer({ restaurantId: "other-rest" }))
      await expect(
        service.getCustomerOrders(RESTAURANT_ID, CUSTOMER_ID)
      ).rejects.toThrow(ForbiddenException)
    })

    it("valid → maps orders with totalAmount = Number(o.total) (BUG-02 regression)", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer())
      prisma.order.findMany.mockResolvedValue([
        {
          id: "ord-1",
          subtotal: new Decimal(200),
          tax: new Decimal(10),
          total: new Decimal(210),
          discount: new Decimal(0),
          serviceCharge: new Decimal(0),
          gstAmount: new Decimal(10),
          table: null,
          branch: { id: "br-1", name: "Main" },
          items: [],
        },
      ])

      const result = await service.getCustomerOrders(RESTAURANT_ID, CUSTOMER_ID)

      expect(result).toHaveLength(1)
      expect(result[0].total).toBe(210)
      expect(result[0].totalAmount).toBe(210)
    })

    it("returned order objects have both total (number) and totalAmount (number) equal", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer())
      prisma.order.findMany.mockResolvedValue([
        {
          id: "ord-1",
          subtotal: new Decimal(100),
          tax: new Decimal(5),
          total: new Decimal(105),
          discount: new Decimal(0),
          serviceCharge: new Decimal(0),
          gstAmount: new Decimal(5),
          table: null,
          branch: { id: "br-1", name: "Main" },
          items: [],
        },
      ])

      const result = await service.getCustomerOrders(RESTAURANT_ID, CUSTOMER_ID)
      expect(typeof result[0].total).toBe("number")
      expect(typeof result[0].totalAmount).toBe("number")
      expect(result[0].total).toBe(result[0].totalAmount)
    })
  })

  // ── createCustomer ─────────────────────────────────────────────────────────

  describe("createCustomer", () => {
    it("duplicate phone → throws ConflictException", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer())
      await expect(
        service.createCustomer(RESTAURANT_ID, { phone: "9999999999", name: "Ravi" } as any)
      ).rejects.toThrow(ConflictException)
    })

    it("valid → calls customer.create, returns serialized with totalSpent as number", async () => {
      prisma.customer.findUnique.mockResolvedValue(null)
      prisma.customer.create.mockResolvedValue(makeCustomer())

      const result = await service.createCustomer(RESTAURANT_ID, { phone: "9999999999", name: "Ravi" } as any)

      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ restaurantId: RESTAURANT_ID, phone: "9999999999" }) })
      )
      expect(typeof result.totalSpent).toBe("number")
    })
  })

  // ── updateCustomer ─────────────────────────────────────────────────────────

  describe("updateCustomer", () => {
    it("customer not found → throws NotFoundException", async () => {
      prisma.customer.findUnique.mockResolvedValue(null)
      await expect(
        service.updateCustomer(RESTAURANT_ID, CUSTOMER_ID, { name: "New" } as any)
      ).rejects.toThrow(NotFoundException)
    })

    it("wrong restaurant → throws ForbiddenException", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer({ restaurantId: "other" }))
      await expect(
        service.updateCustomer(RESTAURANT_ID, CUSTOMER_ID, { name: "New" } as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("phone unchanged → does NOT check uniqueness (findUnique for phone not called again)", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer())
      prisma.customer.update.mockResolvedValue(makeCustomer({ name: "Updated" }))

      // Passing same phone — should not trigger uniqueness check
      await service.updateCustomer(RESTAURANT_ID, CUSTOMER_ID, { phone: "9999999999" } as any)

      // findUnique was only called once (initial owner check), not twice
      expect(prisma.customer.findUnique).toHaveBeenCalledTimes(1)
    })

    it("phone changed to duplicate → throws ConflictException", async () => {
      prisma.customer.findUnique
        .mockResolvedValueOnce(makeCustomer())          // owner check
        .mockResolvedValueOnce(makeCustomer({ id: "other-cust", phone: "8888888888" })) // uniqueness check

      await expect(
        service.updateCustomer(RESTAURANT_ID, CUSTOMER_ID, { phone: "8888888888" } as any)
      ).rejects.toThrow(ConflictException)
    })

    it("valid update → calls customer.update", async () => {
      prisma.customer.findUnique.mockResolvedValueOnce(makeCustomer())
      prisma.customer.findUnique.mockResolvedValueOnce(null) // no conflict on new phone
      prisma.customer.update.mockResolvedValue(makeCustomer({ phone: "7777777777" }))

      await service.updateCustomer(RESTAURANT_ID, CUSTOMER_ID, { phone: "7777777777" } as any)

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: CUSTOMER_ID } })
      )
    })
  })

  // ── deleteCustomer ─────────────────────────────────────────────────────────

  describe("deleteCustomer", () => {
    it("not found → throws NotFoundException", async () => {
      prisma.customer.findUnique.mockResolvedValue(null)
      await expect(
        service.deleteCustomer(RESTAURANT_ID, CUSTOMER_ID)
      ).rejects.toThrow(NotFoundException)
    })

    it("wrong restaurant → throws ForbiddenException", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer({ restaurantId: "other" }))
      await expect(
        service.deleteCustomer(RESTAURANT_ID, CUSTOMER_ID)
      ).rejects.toThrow(ForbiddenException)
    })

    it("valid → calls customer.update with { isActive: false }, returns { success: true }", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer())
      prisma.customer.update.mockResolvedValue(makeCustomer({ isActive: false }))

      const result = await service.deleteCustomer(RESTAURANT_ID, CUSTOMER_ID)

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: CUSTOMER_ID }, data: { isActive: false } })
      )
      expect(result).toEqual({ success: true })
    })
  })
})
