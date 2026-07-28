import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import * as bcrypt from "bcryptjs"
import { z } from "zod"
import { PrismaService } from "../prisma/prisma.service"
import { JwtPayload } from "./interfaces/jwt-payload.interface"

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const CustomerLoginSchema = z.object({
  restaurantId: z.string().min(1),
  phone: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
})

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(body: unknown) {
    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten())
    }
    const { email, password } = parsed.data

    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials")
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new UnauthorizedException("Invalid credentials")

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId ?? undefined,
      branchId: user.branchId ?? undefined,
    }

    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
    })

    const refreshToken = this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
    })

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    // Clean up expired sessions for this user before creating new one
    await this.prisma.session.deleteMany({
      where: {
        userId: user.id,
        expiresAt: { lt: new Date() },
      },
    })

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        refreshToken,
        expiresAt,
      },
    })

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }
  }

  async refresh(refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired or invalid")
    }

    const { user } = session
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId ?? undefined,
      branchId: user.branchId ?? undefined,
    }

    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
    })

    // Update stored access token
    await this.prisma.session.update({
      where: { id: session.id },
      data: { token: accessToken },
    })

    return { accessToken }
  }

  async logout(userId: string, token: string) {
    await this.prisma.session.deleteMany({
      where: { userId, token },
    })
    return { success: true }
  }

  async customerLogin(body: unknown) {
    const parsed = CustomerLoginSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten())
    }
    const { restaurantId, phone, firstName, lastName } = parsed.data

    let customer = await this.prisma.customer.findUnique({
      where: { restaurantId_phone: { restaurantId, phone } },
    })

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          restaurantId,
          phone,
          name: lastName ? `${firstName} ${lastName}` : firstName,
        },
      })
    }

    const payload: JwtPayload = {
      sub: customer.id,
      role: "CUSTOMER",
      restaurantId,
    }

    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
    })

    return {
      accessToken,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        restaurantId: customer.restaurantId,
      },
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        restaurantId: true,
        branchId: true,
        isActive: true,
        createdAt: true,
      },
    })
    if (!user) throw new UnauthorizedException("User not found")
    return user
  }
}
