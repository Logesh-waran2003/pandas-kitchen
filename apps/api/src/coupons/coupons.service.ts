import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { CreateCouponDto, UpdateCouponDto } from "./dto/coupon.dto"

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async listCoupons(restaurantId: string) {
    const coupons = await this.prisma.coupon.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
    })
    return coupons.map(this.serialize)
  }

  async getCoupon(restaurantId: string, id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } })
    if (!coupon) throw new NotFoundException("Coupon not found")
    if (coupon.restaurantId !== restaurantId) throw new ForbiddenException()
    return this.serialize(coupon)
  }

  async createCoupon(restaurantId: string, dto: CreateCouponDto) {
    const code = dto.code.toUpperCase().trim()

    const existing = await this.prisma.coupon.findUnique({
      where: { restaurantId_code: { restaurantId, code } },
    })
    if (existing) throw new ConflictException("A coupon with this code already exists")

    if (dto.discountType === "PERCENT" && dto.discountValue > 100) {
      throw new BadRequestException("Percentage discount cannot exceed 100")
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        restaurantId,
        code,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minOrderValue: dto.minOrderValue ?? 0,
        maxUses: dto.maxUses ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    })
    return this.serialize(coupon)
  }

  async updateCoupon(restaurantId: string, id: string, dto: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } })
    if (!coupon) throw new NotFoundException("Coupon not found")
    if (coupon.restaurantId !== restaurantId) throw new ForbiddenException()

    if (dto.discountType === "PERCENT" && (dto.discountValue ?? Number(coupon.discountValue)) > 100) {
      throw new BadRequestException("Percentage discount cannot exceed 100")
    }

    const updated = await this.prisma.coupon.update({
      where: { id },
      data: {
        ...(dto.discountType !== undefined && { discountType: dto.discountType }),
        ...(dto.discountValue !== undefined && { discountValue: dto.discountValue }),
        ...(dto.minOrderValue !== undefined && { minOrderValue: dto.minOrderValue }),
        ...(dto.maxUses !== undefined && { maxUses: dto.maxUses }),
        ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    })
    return this.serialize(updated)
  }

  async deleteCoupon(restaurantId: string, id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } })
    if (!coupon) throw new NotFoundException("Coupon not found")
    if (coupon.restaurantId !== restaurantId) throw new ForbiddenException()
    if (coupon.usedCount > 0) {
      throw new BadRequestException("Cannot delete a coupon that has been used — deactivate it instead")
    }
    await this.prisma.coupon.delete({ where: { id } })
    return { success: true }
  }

  private serialize(c: any) {
    return {
      ...c,
      discountValue: Number(c.discountValue),
      minOrderValue: Number(c.minOrderValue),
    }
  }
}
