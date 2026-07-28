import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { CreateInventoryItemDto, UpdateInventoryItemDto, AdjustStockDto } from "./dto/inventory.dto"
import { Decimal } from "@prisma/client/runtime/library"

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async listItems(restaurantId: string, branchId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { restaurantId, branchId, isActive: true },
      orderBy: { name: "asc" },
    })
    return items.map(this.serialize)
  }

  async getLowStockItems(restaurantId: string, branchId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { restaurantId, branchId, isActive: true },
    })
    return items
      .filter(i => new Decimal(i.currentStock).lte(new Decimal(i.minStock)))
      .map(this.serialize)
  }

  async createItem(restaurantId: string, userId: string, dto: CreateInventoryItemDto) {
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } })
    if (!branch || branch.restaurantId !== restaurantId) {
      throw new ForbiddenException("Branch not found or access denied")
    }

    const item = await this.prisma.inventoryItem.create({
      data: {
        restaurantId,
        branchId: dto.branchId,
        name: dto.name,
        unit: dto.unit,
        currentStock: dto.currentStock ?? 0,
        minStock: dto.minStock ?? 0,
        costPerUnit: dto.costPerUnit ?? 0,
      },
    })
    return this.serialize(item)
  }

  async updateItem(restaurantId: string, id: string, dto: UpdateInventoryItemDto) {
    await this.assertOwner(restaurantId, id)
    const item = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
        ...(dto.costPerUnit !== undefined && { costPerUnit: dto.costPerUnit }),
      },
    })
    return this.serialize(item)
  }

  async deleteItem(restaurantId: string, id: string) {
    await this.assertOwner(restaurantId, id)
    await this.prisma.inventoryItem.update({ where: { id }, data: { isActive: false } })
    return { success: true }
  }

  async adjustStock(restaurantId: string, id: string, userId: string, dto: AdjustStockDto) {
    const item = await this.assertOwner(restaurantId, id)

    const delta =
      dto.type === "MANUAL_DEDUCTION" || dto.type === "WASTE" || dto.type === "ORDER_DEDUCTION"
        ? new Decimal(-dto.quantity)
        : new Decimal(dto.quantity)

    const newStock = new Decimal(item.currentStock).add(delta)
    if (newStock.lt(0)) {
      throw new BadRequestException("Insufficient stock")
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.inventoryItem.update({
        where: { id },
        data: { currentStock: newStock },
      }),
      this.prisma.stockAdjustment.create({
        data: {
          inventoryItemId: id,
          type: dto.type,
          quantity: dto.quantity,
          note: dto.note,
          createdById: userId,
        },
      }),
    ])

    return this.serialize(updated)
  }

  async getItemHistory(restaurantId: string, id: string) {
    await this.assertOwner(restaurantId, id)
    return this.prisma.stockAdjustment.findMany({
      where: { inventoryItemId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
  }

  private async assertOwner(restaurantId: string, id: string) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } })
    if (!item) throw new NotFoundException("Inventory item not found")
    if (item.restaurantId !== restaurantId) throw new ForbiddenException()
    return item
  }

  private serialize(item: any) {
    return {
      ...item,
      currentStock: Number(item.currentStock),
      minStock: Number(item.minStock),
      costPerUnit: Number(item.costPerUnit),
      isLowStock: new Decimal(item.currentStock).lte(new Decimal(item.minStock)),
    }
  }
}
