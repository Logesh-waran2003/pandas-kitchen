import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { ExtractJwt, Strategy } from "passport-jwt"
import { PrismaService } from "../../prisma/prisma.service"
import { JwtPayload } from "../interfaces/jwt-payload.interface"

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const s = process.env.JWT_SECRET
        if (!s) throw new Error("JWT_SECRET environment variable is not set")
        return s
      })(),
    })
  }

  async validate(payload: JwtPayload) {
    // CUSTOMER tokens: sub = customer.id, no User record exists
    if (payload.role === "CUSTOMER") {
      const customer = await this.prisma.customer.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, restaurantId: true, isActive: true },
      })
      if (!customer || !customer.isActive) return null
      return {
        sub: customer.id,
        id: customer.id,
        name: customer.name,
        role: "CUSTOMER" as const,
        restaurantId: customer.restaurantId,
      }
    }

    // Staff / owner tokens: sub = user.id
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        restaurantId: true,
        branchId: true,
        isActive: true,
      },
    })

    if (!user || !user.isActive) return null
    return user
  }
}
