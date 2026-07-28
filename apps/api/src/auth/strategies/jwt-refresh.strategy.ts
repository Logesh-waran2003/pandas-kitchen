import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { ExtractJwt, Strategy } from "passport-jwt"
import { PrismaService } from "../../prisma/prisma.service"
import { JwtPayload } from "../interfaces/jwt-payload.interface"

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField("refreshToken"),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const s = process.env.JWT_REFRESH_SECRET
        if (!s) throw new Error("JWT_REFRESH_SECRET environment variable is not set")
        return s
      })(),
      passReqToCallback: true,
    })
  }

  async validate(req: any, payload: JwtPayload) {
    const refreshToken = req.body?.refreshToken
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) return null
    return session.user
  }
}
