import { NotFoundException, ForbiddenException, ConflictException } from "@nestjs/common"
import * as bcrypt from "bcryptjs"
import { SettingsService } from "./settings.service"

jest.mock("bcryptjs", () => ({ hash: jest.fn().mockResolvedValue("hashed"), compare: jest.fn() }))

function makePrisma() {
  return {
    restaurant: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    branch: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
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
const STAFF_ID = "user-1"

function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: STAFF_ID,
    restaurantId: RESTAURANT_ID,
    branchId: BRANCH_ID,
    name: "Chef",
    email: "chef@pk.com",
    role: "CAPTAIN",
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  }
}

describe("SettingsService", () => {
  let service: SettingsService
  let prisma: ReturnType<typeof makePrisma>

  beforeEach(() => {
    prisma = makePrisma()
    service = new SettingsService(prisma as any)
    jest.clearAllMocks()
    ;(bcrypt.hash as jest.Mock).mockResolvedValue("hashed")
  })

  // ── getRestaurant ──────────────────────────────────────────────────────────

  describe("getRestaurant", () => {
    it("not found → throws NotFoundException", async () => {
      prisma.restaurant.findUnique.mockResolvedValue(null)
      await expect(service.getRestaurant(RESTAURANT_ID)).rejects.toThrow(NotFoundException)
    })

    it("valid → returns restaurant", async () => {
      const restaurant = { id: RESTAURANT_ID, name: "Pandas Kitchen" }
      prisma.restaurant.findUnique.mockResolvedValue(restaurant)
      const result = await service.getRestaurant(RESTAURANT_ID)
      expect(result).toEqual(restaurant)
    })
  })

  // ── updateRestaurant ───────────────────────────────────────────────────────

  describe("updateRestaurant", () => {
    it("only name provided → data only has name key", async () => {
      prisma.restaurant.update.mockResolvedValue({ id: RESTAURANT_ID, name: "New Name" })
      await service.updateRestaurant(RESTAURANT_ID, { name: "New Name" } as any)

      const updateCall = prisma.restaurant.update.mock.calls[0][0]
      expect(Object.keys(updateCall.data)).toEqual(["name"])
    })

    it("valid → calls restaurant.update with only provided fields (surgical update)", async () => {
      prisma.restaurant.update.mockResolvedValue({ id: RESTAURANT_ID, name: "PK", themeColor: "#FF0000" })
      await service.updateRestaurant(RESTAURANT_ID, { name: "PK", themeColor: "#FF0000" } as any)

      const updateCall = prisma.restaurant.update.mock.calls[0][0]
      expect(updateCall.data).toEqual({ name: "PK", themeColor: "#FF0000" })
      expect(updateCall.data.logoUrl).toBeUndefined()
    })
  })

  // ── createBranch ───────────────────────────────────────────────────────────

  describe("createBranch", () => {
    it("valid → calls branch.create with restaurantId + name", async () => {
      prisma.branch.create.mockResolvedValue({ id: BRANCH_ID, restaurantId: RESTAURANT_ID, name: "South" })
      await service.createBranch(RESTAURANT_ID, { name: "South" } as any)

      expect(prisma.branch.create).toHaveBeenCalledWith({
        data: { restaurantId: RESTAURANT_ID, name: "South" },
      })
    })
  })

  // ── createStaff ────────────────────────────────────────────────────────────

  describe("createStaff", () => {
    it("duplicate email → throws ConflictException", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser())
      await expect(
        service.createStaff(RESTAURANT_ID, {
          email: "chef@pk.com",
          name: "Chef",
          password: "pass123",
        } as any)
      ).rejects.toThrow(ConflictException)
    })

    it("branchId provided but branch belongs to different restaurant → throws ForbiddenException", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID, restaurantId: "other" })

      await expect(
        service.createStaff(RESTAURANT_ID, {
          email: "new@pk.com",
          name: "New",
          password: "pass123",
          branchId: BRANCH_ID,
        } as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("valid → hashes password with bcrypt, calls user.create, returns without passwordHash", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID, restaurantId: RESTAURANT_ID })
      prisma.user.create.mockResolvedValue({
        id: STAFF_ID,
        name: "New",
        email: "new@pk.com",
        role: "CAPTAIN",
        branchId: BRANCH_ID,
        isActive: true,
        createdAt: new Date(),
      })

      await service.createStaff(RESTAURANT_ID, {
        email: "new@pk.com",
        name: "New",
        password: "pass123",
        branchId: BRANCH_ID,
      } as any)

      expect(bcrypt.hash).toHaveBeenCalledWith("pass123", 10)
      const createCall = prisma.user.create.mock.calls[0][0]
      expect(createCall.data.passwordHash).toBe("hashed")
      // The select ensures passwordHash is not returned
      expect(createCall.select).toBeDefined()
      expect(createCall.select.passwordHash).toBeUndefined()
    })
  })

  // ── updateStaff ────────────────────────────────────────────────────────────

  describe("updateStaff", () => {
    it("staff not found → throws NotFoundException", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(
        service.updateStaff(RESTAURANT_ID, STAFF_ID, { name: "X" } as any)
      ).rejects.toThrow(NotFoundException)
    })

    it("wrong restaurant → throws ForbiddenException", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ restaurantId: "other" }))
      await expect(
        service.updateStaff(RESTAURANT_ID, STAFF_ID, { name: "X" } as any)
      ).rejects.toThrow(ForbiddenException)
    })

    it("valid → calls user.update with allowed fields only", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser())
      prisma.user.update.mockResolvedValue(makeUser({ name: "Updated" }))

      await service.updateStaff(RESTAURANT_ID, STAFF_ID, { name: "Updated", role: "MANAGER" } as any)

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: STAFF_ID },
          data: expect.objectContaining({ name: "Updated", role: "MANAGER" }),
        })
      )
    })
  })

  // ── deleteStaff ────────────────────────────────────────────────────────────

  describe("deleteStaff", () => {
    it("not found → throws NotFoundException", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.deleteStaff(RESTAURANT_ID, STAFF_ID)).rejects.toThrow(NotFoundException)
    })

    it("wrong restaurant → throws ForbiddenException", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ restaurantId: "other" }))
      await expect(service.deleteStaff(RESTAURANT_ID, STAFF_ID)).rejects.toThrow(ForbiddenException)
    })

    it("valid → calls user.update with { isActive: false }, returns { success: true }", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser())
      prisma.user.update.mockResolvedValue(makeUser({ isActive: false }))

      const result = await service.deleteStaff(RESTAURANT_ID, STAFF_ID)

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: STAFF_ID }, data: { isActive: false } })
      )
      expect(result).toEqual({ success: true })
    })
  })
})
