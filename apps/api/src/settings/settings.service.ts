import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common"
import * as bcrypt from "bcryptjs"
import { PrismaService } from "../prisma/prisma.service"
import { UpdateRestaurantDto } from "./dto/update-restaurant.dto"
import { CreateBranchDto, UpdateBranchDto } from "./dto/branch.dto"
import { CreateStaffDto, UpdateStaffDto } from "./dto/staff.dto"
import { UpdateOnlineSettingsDto } from "./dto/online-settings.dto"

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // ── Restaurant ───────────────────────────────────────────────────────────────

  async getRestaurant(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    })
    if (!restaurant) throw new NotFoundException("Restaurant not found")
    return restaurant
  }

  async updateRestaurant(restaurantId: string, dto: UpdateRestaurantDto) {
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.themeColor !== undefined && { themeColor: dto.themeColor }),
      },
    })
  }

  // ── Branches ─────────────────────────────────────────────────────────────────

  async listBranches(restaurantId: string) {
    return this.prisma.branch.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "asc" },
    })
  }

  async createBranch(restaurantId: string, dto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: { restaurantId, name: dto.name },
    })
  }

  async updateBranch(restaurantId: string, id: string, dto: UpdateBranchDto) {
    await this.assertBranchOwner(restaurantId, id)
    return this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    })
  }

  // ── Staff ────────────────────────────────────────────────────────────────────

  async listStaff(restaurantId: string) {
    return this.prisma.user.findMany({
      where: { restaurantId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        branchId: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    })
  }

  async createStaff(restaurantId: string, dto: CreateStaffDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException("Email already in use")

    if (dto.branchId) {
      await this.assertBranchOwner(restaurantId, dto.branchId)
    }

    const passwordHash = await bcrypt.hash(dto.password, 10)

    return this.prisma.user.create({
      data: {
        restaurantId,
        branchId: dto.branchId,
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role ?? "CAPTAIN",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        isActive: true,
        createdAt: true,
      },
    })
  }

  async updateStaff(restaurantId: string, id: string, dto: UpdateStaffDto) {
    await this.assertStaffOwner(restaurantId, id)
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        isActive: true,
        createdAt: true,
      },
    })
  }

  async deleteStaff(restaurantId: string, id: string) {
    await this.assertStaffOwner(restaurantId, id)
    await this.prisma.user.update({ where: { id }, data: { isActive: false } })
    return { success: true }
  }

  // ── Online Settings ──────────────────────────────────────────────────────────

  async getOnlineSettings(restaurantId: string) {
    const settings = await this.prisma.restaurantOnlineSettings.findUnique({
      where: { restaurantId },
    })

    if (settings) return this.serializeOnlineSettings(settings)

    // Create defaults on first access
    const created = await this.prisma.restaurantOnlineSettings.create({
      data: { restaurantId },
    })
    return this.serializeOnlineSettings(created)
  }

  async updateOnlineSettings(restaurantId: string, dto: UpdateOnlineSettingsDto) {
    const fields = {
      ...(dto.onlineOrderingEnabled !== undefined && { onlineOrderingEnabled: dto.onlineOrderingEnabled }),
      ...(dto.deliveryEnabled !== undefined && { deliveryEnabled: dto.deliveryEnabled }),
      ...(dto.takeawayEnabled !== undefined && { takeawayEnabled: dto.takeawayEnabled }),
      ...(dto.deliveryRadiusKm !== undefined && { deliveryRadiusKm: dto.deliveryRadiusKm }),
      ...(dto.minOrderValue !== undefined && { minOrderValue: dto.minOrderValue }),
      ...(dto.deliveryFee !== undefined && { deliveryFee: dto.deliveryFee }),
      ...(dto.packagingFee !== undefined && { packagingFee: dto.packagingFee }),
      ...(dto.serviceChargePercent !== undefined && { serviceChargePercent: dto.serviceChargePercent }),
      ...(dto.estimatedPrepMins !== undefined && { estimatedPrepMins: dto.estimatedPrepMins }),
      ...(dto.pickupPrepMins !== undefined && { pickupPrepMins: dto.pickupPrepMins }),
      ...(dto.loyaltyPointsPerRupee !== undefined && { loyaltyPointsPerRupee: dto.loyaltyPointsPerRupee }),
      ...(dto.loyaltyRedemptionRate !== undefined && { loyaltyRedemptionRate: dto.loyaltyRedemptionRate }),
    }
    const result = await this.prisma.restaurantOnlineSettings.upsert({
      where: { restaurantId },
      create: { restaurantId, ...fields },
      update: fields,
    })
    return this.serializeOnlineSettings(result)
  }

  // ── Public restaurant info ───────────────────────────────────────────────────

  async getPublicRestaurantInfo(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        themeColor: true,
        isActive: true,
        branches: {
          where: { isActive: true },
          select: { id: true, name: true },
          take: 1,
        },
        onlineSettings: true,
      },
    })
    if (!restaurant) throw new NotFoundException("Restaurant not found")
    return restaurant
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private serializeOnlineSettings(s: any) {
    return {
      ...s,
      minOrderValue: Number(s.minOrderValue),
      deliveryFee: Number(s.deliveryFee),
      packagingFee: Number(s.packagingFee),
      serviceChargePercent: Number(s.serviceChargePercent),
      gstRate: Number(s.gstRate ?? 5),
      // loyaltyPointsPerRupee and loyaltyRedemptionRate are plain Float — no conversion needed
    }
  }

  private async assertBranchOwner(restaurantId: string, id: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } })
    if (!branch) throw new NotFoundException("Branch not found")
    if (branch.restaurantId !== restaurantId) throw new ForbiddenException()
    return branch
  }

  private async assertStaffOwner(restaurantId: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException("Staff member not found")
    if (user.restaurantId !== restaurantId) throw new ForbiddenException()
    return user
  }
}
