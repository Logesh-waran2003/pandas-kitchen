import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { CreateTableDto } from "./dto/create-table.dto"
import { UpdateTableDto } from "./dto/update-table.dto"
import { UpdateTableStatusDto } from "./dto/update-table-status.dto"

@Injectable()
export class TablesService {
  constructor(private prisma: PrismaService) {}

  async listTables(restaurantId: string, branchId: string) {
    return this.prisma.table.findMany({
      where: { restaurantId, branchId, isActive: true },
      orderBy: { tableNumber: "asc" },
    })
  }

  async createTable(restaurantId: string, dto: CreateTableDto) {
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } })
    if (!branch || branch.restaurantId !== restaurantId) {
      throw new ForbiddenException("Branch not found or access denied")
    }

    const table = await this.prisma.table.create({
      data: {
        restaurantId,
        branchId: dto.branchId,
        tableNumber: dto.tableNumber,
        capacity: dto.capacity ?? 4,
        status: dto.status ?? "AVAILABLE",
      },
    })

    // Generate QR code string after we have the id
    const updated = await this.prisma.table.update({
      where: { id: table.id },
      data: { qrCode: `table-${table.id}` },
    })

    return updated
  }

  async updateTable(restaurantId: string, id: string, dto: UpdateTableDto) {
    await this.assertOwner(restaurantId, id)
    return this.prisma.table.update({
      where: { id },
      data: {
        ...(dto.tableNumber !== undefined && { tableNumber: dto.tableNumber }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    })
  }

  async deleteTable(restaurantId: string, id: string) {
    await this.assertOwner(restaurantId, id)
    await this.prisma.table.update({ where: { id }, data: { isActive: false } })
    return { success: true }
  }

  async updateStatus(restaurantId: string, id: string, dto: UpdateTableStatusDto) {
    await this.assertOwner(restaurantId, id)
    return this.prisma.table.update({
      where: { id },
      data: { status: dto.status },
    })
  }

  private async assertOwner(restaurantId: string, id: string) {
    const table = await this.prisma.table.findUnique({ where: { id } })
    if (!table) throw new NotFoundException("Table not found")
    if (table.restaurantId !== restaurantId) throw new ForbiddenException()
    return table
  }
}
