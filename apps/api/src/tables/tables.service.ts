import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { EventsGateway } from "../events/events.gateway"
import { CreateTableDto } from "./dto/create-table.dto"
import { UpdateTableDto } from "./dto/update-table.dto"
import { UpdateTableStatusDto } from "./dto/update-table-status.dto"

@Injectable()
export class TablesService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

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
        ...(dto.posX !== undefined && { posX: dto.posX }),
        ...(dto.posY !== undefined && { posY: dto.posY }),
        ...(dto.width !== undefined && { width: dto.width }),
        ...(dto.height !== undefined && { height: dto.height }),
        ...(dto.shape !== undefined && { shape: dto.shape }),
      },
    })
  }

  async deleteTable(restaurantId: string, id: string) {
    await this.assertOwner(restaurantId, id)
    await this.prisma.table.update({ where: { id }, data: { isActive: false } })
    return { success: true }
  }

  async updateStatus(restaurantId: string, id: string, dto: UpdateTableStatusDto) {
    const table = await this.assertOwner(restaurantId, id)
    const updated = await this.prisma.table.update({
      where: { id },
      data: { status: dto.status },
    })
    this.events.emitToBranch(table.branchId, "table.status_changed", {
      id: updated.id,
      tableNumber: updated.tableNumber,
      status: updated.status,
    })
    return updated
  }

  async mergeTables(primaryOrderId: string, secondaryOrderId: string, restaurantId: string) {
    const [primary, secondary] = await Promise.all([
      this.prisma.order.findUnique({ where: { id: primaryOrderId }, include: { items: true } }),
      this.prisma.order.findUnique({ where: { id: secondaryOrderId }, include: { items: true } }),
    ])

    if (!primary || primary.restaurantId !== restaurantId) throw new NotFoundException("Primary order not found")
    if (!secondary || secondary.restaurantId !== restaurantId) throw new NotFoundException("Secondary order not found")
    if (["CLOSED", "CANCELLED", "PAID"].includes(primary.status)) throw new BadRequestException("Primary order is closed")
    if (["CLOSED", "CANCELLED", "PAID"].includes(secondary.status)) throw new BadRequestException("Secondary order is closed")

    const mergedItemCount = secondary.items.length

    await this.prisma.$transaction(async (tx) => {
      // Move all items from secondary to primary
      await tx.orderItem.updateMany({
        where: { orderId: secondaryOrderId },
        data: { orderId: primaryOrderId },
      })

      // Recalculate primary totals from updated item list
      const items = await tx.orderItem.findMany({ where: { orderId: primaryOrderId } })
      const subtotal = items.reduce((s, i) => s + Number(i.totalPrice), 0)
      const gstRate = Number(primary.gstRate ?? 5)
      const gstAmt = parseFloat((subtotal * (gstRate / 100)).toFixed(2))
      const serviceCharge = Number(primary.serviceCharge ?? 0)
      const discount = Number(primary.discount ?? 0)
      const total = subtotal + gstAmt + serviceCharge - discount

      await tx.order.update({
        where: { id: primaryOrderId },
        data: {
          subtotal,
          tax: gstAmt,
          gstAmount: gstAmt,
          total,
        },
      })

      // Cancel secondary order
      await tx.order.update({
        where: { id: secondaryOrderId },
        data: { status: "CANCELLED" },
      })

      // Free the secondary table
      if (secondary.tableId) {
        await tx.table.update({ where: { id: secondary.tableId }, data: { status: "AVAILABLE" } })
      }
    })

    this.events.emitToBranch(primary.branchId, "order.merged", { primaryOrderId, secondaryOrderId })
    return { success: true, primaryOrderId, mergedItemCount }
  }

  async transferTable(orderId: string, newTableId: string, restaurantId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order || order.restaurantId !== restaurantId) throw new NotFoundException('Order not found')
    if (['PAID', 'CANCELLED'].includes(order.status)) throw new BadRequestException('Cannot transfer a closed or cancelled order')

    const newTable = await this.prisma.table.findUnique({ where: { id: newTableId } })
    if (!newTable) throw new NotFoundException('Target table not found')
    if (newTable.status !== 'AVAILABLE') throw new BadRequestException('Target table is not available')

    const oldTableId = order.tableId
    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id: orderId }, data: { tableId: newTableId } }),
      this.prisma.table.update({ where: { id: newTableId }, data: { status: 'OCCUPIED' } }),
      ...(oldTableId ? [this.prisma.table.update({ where: { id: oldTableId }, data: { status: 'AVAILABLE' } })] : []),
    ])

    this.events.emitToBranch(order.branchId, 'table.transferred', { orderId, fromTableId: oldTableId, toTableId: newTableId })
    this.events.emitToBranch(order.branchId, 'table.status_changed', { tableId: newTableId, status: 'OCCUPIED' })
    if (oldTableId) this.events.emitToBranch(order.branchId, 'table.status_changed', { tableId: oldTableId, status: 'AVAILABLE' })

    return { success: true, orderId, newTableId }
  }

  async getPublicTable(id: string) {
    const table = await this.prisma.table.findUnique({
      where: { id },
      include: {
        restaurant: { select: { id: true, name: true, slug: true, themeColor: true } },
      },
    })
    if (!table || !table.isActive) throw new NotFoundException("Table not found")
    return {
      id: table.id,
      tableNumber: table.tableNumber,
      branchId: table.branchId,
      restaurantId: table.restaurantId,
      restaurantName: table.restaurant.name,
      restaurantSlug: table.restaurant.slug,
      themeColor: table.restaurant.themeColor,
    }
  }

  async getQRCode(tableId: string, restaurantId: string) {
    const table = await this.prisma.table.findUnique({ where: { id: tableId } })
    if (!table) throw new NotFoundException('Table not found')
    if (table.restaurantId !== restaurantId) throw new NotFoundException('Table not found')

    const CUSTOMER_URL = process.env.CUSTOMER_WEB_URL ?? 'http://192.168.0.109:3003'
    const url = `${CUSTOMER_URL}/table/${tableId}`

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const QRCode = require('qrcode')
    const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 })
    return { qrDataUrl, tableNumber: table.tableNumber, url }
  }

  private async assertOwner(restaurantId: string, id: string) {
    const table = await this.prisma.table.findUnique({ where: { id } })
    if (!table) throw new NotFoundException("Table not found")
    if (table.restaurantId !== restaurantId) throw new ForbiddenException()
    return table
  }
}
