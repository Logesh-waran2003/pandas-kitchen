import { UnauthorizedException, BadRequestException, NotFoundException } from "@nestjs/common"
import * as bcrypt from "bcryptjs"
import { AuthService } from "./auth.service"

jest.mock("bcryptjs", () => ({ compare: jest.fn() }))

const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>

function makePrisma() {
  return {
    user: {
      findUnique: jest.fn(),
    },
    session: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    restaurant: {
      findUnique: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  }
}

function makeJwt() {
  return {
    sign: jest.fn().mockReturnValue("signed-token"),
  }
}

const RESTAURANT_ID = "rest-1"
const USER_ID = "user-1"
const CUSTOMER_ID = "cust-1"

describe("AuthService", () => {
  let service: AuthService
  let prisma: ReturnType<typeof makePrisma>
  let jwt: ReturnType<typeof makeJwt>

  beforeEach(() => {
    prisma = makePrisma()
    jwt = makeJwt()
    service = new AuthService(prisma as any, jwt as any)
    jest.clearAllMocks()
    jwt.sign.mockReturnValue("signed-token")
  })

  // ── login ────────────────────────────────────────────────────────────────

  describe("login", () => {
    const validUser = {
      id: USER_ID,
      email: "chef@pk.com",
      name: "Chef",
      role: "OWNER",
      restaurantId: RESTAURANT_ID,
      branchId: null,
      passwordHash: "hashed",
      isActive: true,
    }

    it("valid credentials → returns accessToken, refreshToken, user shape", async () => {
      prisma.user.findUnique.mockResolvedValue(validUser)
      ;(mockBcrypt.compare as jest.Mock).mockResolvedValue(true)
      prisma.session.deleteMany.mockResolvedValue({ count: 0 })
      prisma.session.create.mockResolvedValue({})

      const result = await service.login({ email: "chef@pk.com", password: "secret123" })

      expect(result).toMatchObject({
        accessToken: "signed-token",
        refreshToken: "signed-token",
        user: { id: USER_ID, email: "chef@pk.com" },
      })
    })

    it("wrong password → throws UnauthorizedException", async () => {
      prisma.user.findUnique.mockResolvedValue(validUser)
      ;(mockBcrypt.compare as jest.Mock).mockResolvedValue(false)

      await expect(
        service.login({ email: "chef@pk.com", password: "wrongpass" })
      ).rejects.toThrow(UnauthorizedException)
    })

    it("unknown email → throws UnauthorizedException", async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(
        service.login({ email: "nobody@pk.com", password: "secret123" })
      ).rejects.toThrow(UnauthorizedException)
    })

    it("inactive user → throws UnauthorizedException", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...validUser, isActive: false })

      await expect(
        service.login({ email: "chef@pk.com", password: "secret123" })
      ).rejects.toThrow(UnauthorizedException)
    })

    it("invalid body (missing password) → throws BadRequestException", async () => {
      await expect(
        service.login({ email: "chef@pk.com" })
      ).rejects.toThrow(BadRequestException)
    })
  })

  // ── refresh ──────────────────────────────────────────────────────────────

  describe("refresh", () => {
    const futureDate = new Date(Date.now() + 86400_000)
    const pastDate = new Date(Date.now() - 1000)
    const user = { id: USER_ID, email: "chef@pk.com", role: "OWNER", restaurantId: RESTAURANT_ID, branchId: null }

    it("valid refreshToken → returns new accessToken", async () => {
      prisma.session.findUnique.mockResolvedValue({ id: "sess-1", expiresAt: futureDate, user })
      prisma.session.update.mockResolvedValue({})

      const result = await service.refresh("valid-refresh")
      expect(result).toMatchObject({ accessToken: "signed-token" })
    })

    it("session not found → throws UnauthorizedException", async () => {
      prisma.session.findUnique.mockResolvedValue(null)

      await expect(service.refresh("bad-refresh")).rejects.toThrow(UnauthorizedException)
    })

    it("expired session → throws UnauthorizedException", async () => {
      prisma.session.findUnique.mockResolvedValue({ id: "sess-1", expiresAt: pastDate, user })

      await expect(service.refresh("expired-refresh")).rejects.toThrow(UnauthorizedException)
    })
  })

  // ── customerLogin ─────────────────────────────────────────────────────────

  describe("customerLogin", () => {
    const validBody = {
      restaurantId: RESTAURANT_ID,
      phone: "9999999999",
      firstName: "Ravi",
    }
    const existingCustomer = { id: CUSTOMER_ID, name: "Ravi", phone: "9999999999", restaurantId: RESTAURANT_ID }

    it("restaurant not found → throws NotFoundException", async () => {
      prisma.restaurant.findUnique.mockResolvedValue(null)

      await expect(service.customerLogin(validBody)).rejects.toThrow(NotFoundException)
    })

    it("new phone → creates customer, returns accessToken + customer", async () => {
      prisma.restaurant.findUnique.mockResolvedValue({ id: RESTAURANT_ID })
      prisma.customer.findUnique.mockResolvedValue(null)
      prisma.customer.create.mockResolvedValue(existingCustomer)

      const result = await service.customerLogin(validBody)

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ phone: "9999999999", restaurantId: RESTAURANT_ID }),
      })
      expect(result).toMatchObject({ accessToken: "signed-token", customer: { id: CUSTOMER_ID } })
    })

    it("existing phone → returns accessToken, does NOT create duplicate", async () => {
      prisma.restaurant.findUnique.mockResolvedValue({ id: RESTAURANT_ID })
      prisma.customer.findUnique.mockResolvedValue(existingCustomer)

      const result = await service.customerLogin(validBody)

      expect(prisma.customer.create).not.toHaveBeenCalled()
      expect(result).toMatchObject({ accessToken: "signed-token", customer: { id: CUSTOMER_ID } })
    })

    it("missing firstName → throws BadRequestException", async () => {
      await expect(
        service.customerLogin({ restaurantId: RESTAURANT_ID, phone: "9999999999" })
      ).rejects.toThrow(BadRequestException)
    })
  })
})
