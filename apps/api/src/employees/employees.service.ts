import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common"
import * as bcrypt from "bcryptjs"
import { PrismaService } from "../prisma/prisma.service"
import { CreateEmployeeDto, UpdateEmployeeDto } from "./dto/employee.dto"

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async list(restaurantId: string, branchId?: string) {
    return this.prisma.user.findMany({
      where: {
        restaurantId,
        ...(branchId ? { branchId } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        restaurantId: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  }

  async findOne(restaurantId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        restaurantId: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
      },
    })
    if (!user || user.restaurantId !== restaurantId) {
      throw new NotFoundException("Employee not found")
    }
    return user
  }

  async create(dto: CreateEmployeeDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException("Email already in use")

    const passwordHash = await bcrypt.hash(dto.password, 10)

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
        restaurantId: dto.restaurantId,
        branchId: dto.branchId ?? null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        restaurantId: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
      },
    })
  }

  async update(restaurantId: string, id: string, dto: UpdateEmployeeDto) {
    await this.findOne(restaurantId, id)

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        restaurantId: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
      },
    })
  }

  async deactivate(restaurantId: string, id: string) {
    await this.findOne(restaurantId, id)
    await this.prisma.user.update({ where: { id }, data: { isActive: false } })
    return { success: true }
  }
}
