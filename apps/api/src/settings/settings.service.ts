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

  // ── Helpers ──────────────────────────────────────────────────────────────────

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
