import { NotFoundException, ConflictException } from "@nestjs/common"
import * as bcrypt from "bcryptjs"
import { EmployeesService } from "./employees.service"

jest.mock("bcryptjs", () => ({ hash: jest.fn().mockResolvedValue("hashed"), compare: jest.fn() }))

function makePrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  }
}

const RESTAURANT_ID = "rest-1"
const BRANCH_ID = "branch-1"
const EMPLOYEE_ID = "user-1"

function makeEmployee(overrides: Record<string, any> = {}) {
  return {
    id: EMPLOYEE_ID,
    restaurantId: RESTAURANT_ID,
    branchId: BRANCH_ID,
    name: "Chef",
    email: "chef@pk.com",
    phone: null,
    role: "CAPTAIN",
    isActive: true,
    createdAt: new Date(),
    branch: { id: BRANCH_ID, name: "Main" },
    ...overrides,
  }
}

describe("EmployeesService", () => {
  let service: EmployeesService
  let prisma: ReturnType<typeof makePrisma>

  beforeEach(() => {
    prisma = makePrisma()
    service = new EmployeesService(prisma as any)
    jest.clearAllMocks()
    ;(bcrypt.hash as jest.Mock).mockResolvedValue("hashed")
  })

  // ── findOne ────────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("not found → throws NotFoundException", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.findOne(RESTAURANT_ID, EMPLOYEE_ID)).rejects.toThrow(NotFoundException)
    })

    it("wrong restaurant → throws NotFoundException", async () => {
      prisma.user.findUnique.mockResolvedValue(makeEmployee({ restaurantId: "other" }))
      await expect(service.findOne(RESTAURANT_ID, EMPLOYEE_ID)).rejects.toThrow(NotFoundException)
    })

    it("valid → returns user without passwordHash", async () => {
      const emp = makeEmployee()
      prisma.user.findUnique.mockResolvedValue(emp)

      const result = await service.findOne(RESTAURANT_ID, EMPLOYEE_ID)

      expect(result.id).toBe(EMPLOYEE_ID)
      // Prisma select excludes passwordHash; the returned object should not have it
      expect((result as any).passwordHash).toBeUndefined()
    })
  })

  // ── create ─────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("duplicate email → throws ConflictException", async () => {
      prisma.user.findUnique.mockResolvedValue(makeEmployee())
      await expect(
        service.create({
          email: "chef@pk.com",
          name: "Chef",
          password: "pass123",
          role: "CAPTAIN",
          restaurantId: RESTAURANT_ID,
        } as any)
      ).rejects.toThrow(ConflictException)
    })

    it("valid → hashes password, calls user.create", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.create.mockResolvedValue(makeEmployee())

      await service.create({
        email: "new@pk.com",
        name: "New",
        password: "pass123",
        role: "CAPTAIN",
        restaurantId: RESTAURANT_ID,
        branchId: BRANCH_ID,
      } as any)

      expect(bcrypt.hash).toHaveBeenCalledWith("pass123", 10)
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "new@pk.com",
            passwordHash: "hashed",
            restaurantId: RESTAURANT_ID,
          }),
        })
      )
    })
  })

  // ── update ─────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("not found → throws NotFoundException", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(
        service.update(RESTAURANT_ID, EMPLOYEE_ID, { name: "X" } as any)
      ).rejects.toThrow(NotFoundException)
    })

    it("wrong restaurant → throws NotFoundException (findOne checks this)", async () => {
      prisma.user.findUnique.mockResolvedValue(makeEmployee({ restaurantId: "other" }))
      await expect(
        service.update(RESTAURANT_ID, EMPLOYEE_ID, { name: "X" } as any)
      ).rejects.toThrow(NotFoundException)
    })

    it("valid → calls user.update with allowed fields", async () => {
      prisma.user.findUnique.mockResolvedValue(makeEmployee())
      prisma.user.update.mockResolvedValue(makeEmployee({ name: "Updated", role: "MANAGER" }))

      await service.update(RESTAURANT_ID, EMPLOYEE_ID, { name: "Updated", role: "MANAGER" } as any)

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: EMPLOYEE_ID },
          data: expect.objectContaining({ name: "Updated", role: "MANAGER" }),
        })
      )
    })
  })

  // ── deactivate ─────────────────────────────────────────────────────────────

  describe("deactivate", () => {
    it("not found → throws NotFoundException", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.deactivate(RESTAURANT_ID, EMPLOYEE_ID)).rejects.toThrow(NotFoundException)
    })

    it("wrong restaurant → throws NotFoundException", async () => {
      prisma.user.findUnique.mockResolvedValue(makeEmployee({ restaurantId: "other" }))
      await expect(service.deactivate(RESTAURANT_ID, EMPLOYEE_ID)).rejects.toThrow(NotFoundException)
    })

    it("valid → sets isActive: false, returns { success: true }", async () => {
      prisma.user.findUnique.mockResolvedValue(makeEmployee())
      prisma.user.update.mockResolvedValue(makeEmployee({ isActive: false }))

      const result = await service.deactivate(RESTAURANT_ID, EMPLOYEE_ID)

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: EMPLOYEE_ID },
          data: { isActive: false },
        })
      )
      expect(result).toEqual({ success: true })
    })
  })
})
