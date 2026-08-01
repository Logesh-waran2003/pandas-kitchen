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

    const [updated] = await this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.inventoryItem.update({
        where: { id },
        data: { currentStock: newStock },
      })
      const adjustment = await tx.stockAdjustment.create({
        data: {
          inventoryItemId: id,
          type: dto.type,
          quantity: dto.quantity,
          note: dto.note,
          createdById: userId,
        },
      })

      // BUG-H03: auto-disable linked menu items when stock hits zero
      if (newStock.lte(0) && (dto.type === "MANUAL_DEDUCTION" || dto.type === "WASTE" || dto.type === "ORDER_DEDUCTION")) {
        const ingredients = await tx.menuItemIngredient.findMany({
          where: { inventoryItemId: id },
          select: { menuItemId: true },
        })
        if (ingredients.length > 0) {
          const menuItemIds = ingredients.map((ing) => ing.menuItemId)
          await tx.menuItem.updateMany({
            where: { id: { in: menuItemIds }, isAvailable: true },
            data: { isAvailable: false },
          })
        }
      }

      return [updatedItem, adjustment]
    })

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

  // ── BOM / Ingredient management ──────────────────────────────────────────

  async listIngredients(restaurantId: string, menuItemId: string) {
    // Verify the menu item belongs to this restaurant
    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } })
    if (!menuItem || menuItem.restaurantId !== restaurantId) throw new NotFoundException("Menu item not found")

    return this.prisma.menuItemIngredient.findMany({
      where: { menuItemId },
      include: {
        inventoryItem: { select: { id: true, name: true, unit: true, currentStock: true } },
      },
    })
  }

  async addIngredient(restaurantId: string, menuItemId: string, inventoryItemId: string, quantity: number) {
    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } })
    if (!menuItem || menuItem.restaurantId !== restaurantId) throw new NotFoundException("Menu item not found")

    const invItem = await this.prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } })
    if (!invItem || invItem.restaurantId !== restaurantId) throw new NotFoundException("Inventory item not found")

    return this.prisma.menuItemIngredient.create({
      data: { menuItemId, inventoryItemId, quantity },
      include: {
        inventoryItem: { select: { id: true, name: true, unit: true } },
      },
    })
  }

  async removeIngredient(restaurantId: string, id: string) {
    const ingredient = await this.prisma.menuItemIngredient.findUnique({
      where: { id },
      include: { menuItem: true },
    })
    if (!ingredient) throw new NotFoundException("Ingredient link not found")
    if (ingredient.menuItem.restaurantId !== restaurantId) throw new ForbiddenException()

    await this.prisma.menuItemIngredient.delete({ where: { id } })
    return { success: true }
  }

  // ── Auto-deduct / restore stock tied to an order ─────────────────────────

  async restoreForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            menuItem: { include: { ingredients: true } },
          },
        },
      },
    })
    if (!order) return

    const restorations: Array<{ inventoryItemId: string; qty: number }> = []

    for (const orderItem of order.items) {
      for (const ingredient of (orderItem.menuItem?.ingredients ?? [])) {
        const qty = Number(ingredient.quantity) * orderItem.quantity
        const existing = restorations.find(r => r.inventoryItemId === ingredient.inventoryItemId)
        if (existing) existing.qty += qty
        else restorations.push({ inventoryItemId: ingredient.inventoryItemId, qty })
      }
    }

    for (const r of restorations) {
      await this.prisma.inventoryItem.update({
        where: { id: r.inventoryItemId },
        data: { currentStock: { increment: r.qty } },
      })
      await this.prisma.stockAdjustment.create({
        data: {
          inventoryItemId: r.inventoryItemId,
          type: "RESTOCK",
          quantity: r.qty,
          note: `Restored for cancelled order ${orderId}`,
        },
      })
    }
  }

  async deductForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            menuItem: { include: { ingredients: true } },
          },
        },
      },
    })
    if (!order) return

    const deductions: Array<{ inventoryItemId: string; qty: number }> = []

    for (const orderItem of order.items) {
      for (const ingredient of (orderItem.menuItem?.ingredients ?? [])) {
        const qty = Number(ingredient.quantity) * orderItem.quantity
        const existing = deductions.find(d => d.inventoryItemId === ingredient.inventoryItemId)
        if (existing) existing.qty += qty
        else deductions.push({ inventoryItemId: ingredient.inventoryItemId, qty })
      }
    }

    for (const d of deductions) {
      await this.prisma.inventoryItem.update({
        where: { id: d.inventoryItemId },
        data: { currentStock: { decrement: d.qty } },
      })
      await this.prisma.stockAdjustment.create({
        data: {
          inventoryItemId: d.inventoryItemId,
          type: "ORDER_DEDUCTION",
          quantity: d.qty,
          note: `Auto-deducted for order ${orderId}`,
        },
      })
    }
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
