import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { EventsGateway } from "../events/events.gateway"
import { InventoryService } from "../inventory/inventory.service"
import { KitchenService } from "../kitchen/kitchen.service"
import { CreateOrderDto } from "./dto/create-order.dto"
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto"
import { OrderStatus, OrderType } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
    private inventoryService: InventoryService,
    private kitchenService: KitchenService,
  ) {}

  async listOrders(restaurantId: string, branchId?: string, status?: string, date?: string) {
    const where: any = { restaurantId }

    if (branchId) where.branchId = branchId
    if (status) where.status = status as OrderStatus

    if (date) {
      const start = new Date(date)
      const end = new Date(date)
      end.setDate(end.getDate() + 1)
      where.createdAt = { gte: start, lt: end }
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        table: { select: { id: true, tableNumber: true } },
        branch: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true } },
            addons: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return orders.map(this.serializeOrder)
  }

  async findOneForTracking(orderId: string, customerId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { menuItem: { select: { name: true } } },
        },
      },
    })

    if (!order) throw new NotFoundException("Order not found")
    if (order.customerId !== customerId) throw new ForbiddenException()

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      orderType: order.orderType,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      createdAt: order.createdAt,
      items: order.items.map((i) => ({
        id: i.id,
        name: i.menuItem?.name ?? "",
        quantity: i.quantity,
        price: Number(i.unitPrice),
        totalPrice: Number(i.totalPrice),
        variantName: i.variantName ?? null,
      })),
    }
  }

  async getOrder(restaurantId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        table: { select: { id: true, tableNumber: true } },
        branch: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true, imageUrl: true } },
            addons: true,
          },
        },
        payments: true,
      },
    })

    if (!order) throw new NotFoundException("Order not found")
    if (order.restaurantId !== restaurantId) throw new ForbiddenException()

    return this.serializeOrder(order)
  }

  async createPublicOrder(dto: CreateOrderDto) {
    // Resolve restaurantId from branchId — no auth context available
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } })
    if (!branch || !branch.isActive) {
      throw new NotFoundException("Branch not found")
    }
    return this.createOrder(branch.restaurantId, "", dto)
  }

  async createOrder(restaurantId: string, userId: string, dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException("Order must have at least one item")
    }

    if (dto.orderType === OrderType.DELIVERY && !dto.deliveryAddress) {
      throw new BadRequestException("Delivery address required for delivery orders")
    }

    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } })
    if (!branch || branch.restaurantId !== restaurantId) {
      throw new ForbiddenException("Branch not found or access denied")
    }

    // Validate customer if provided
    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } })
      if (!customer || customer.restaurantId !== restaurantId) {
        throw new NotFoundException("Customer not found")
      }
    }

    // Fetch all menu items upfront
    const menuItemIds = dto.items.map((i) => i.menuItemId)
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, restaurantId },
    })
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]))

    for (const item of dto.items) {
      if (!menuItemMap.has(item.menuItemId)) {
        throw new NotFoundException(`Menu item ${item.menuItemId} not found`)
      }
    }

    // Fetch all variants upfront (if any)
    const variantIds = dto.items.map((i) => i.variantId).filter(Boolean) as string[]
    const variants = variantIds.length
      ? await this.prisma.menuItemVariant.findMany({ where: { id: { in: variantIds } } })
      : []
    const variantMap = new Map(variants.map((v) => [v.id, v]))

    // Fetch all addons upfront (if any)
    const allAddonIds = dto.items.flatMap((i) => i.addonIds ?? [])
    const addons = allAddonIds.length
      ? await this.prisma.menuAddon.findMany({ where: { id: { in: allAddonIds } } })
      : []
    const addonMap = new Map(addons.map((a) => [a.id, a]))

    // Build line items
    const lineItems = dto.items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId)!

      // Use variant price if provided, else menu item base price
      let unitPrice = new Decimal(menuItem.price)
      let variantName: string | undefined
      if (item.variantId) {
        const variant = variantMap.get(item.variantId)
        if (!variant || variant.menuItemId !== item.menuItemId) {
          throw new NotFoundException(`Variant ${item.variantId} not found for item ${item.menuItemId}`)
        }
        unitPrice = new Decimal(variant.price)
        variantName = variant.name
      }

      // Compute addons total
      const itemAddons = (item.addonIds ?? []).map((addonId) => {
        const addon = addonMap.get(addonId)
        if (!addon) throw new NotFoundException(`Addon ${addonId} not found`)
        return { addonId, name: addon.name, price: new Decimal(addon.price) }
      })
      const addonsTotal = itemAddons.reduce((sum, a) => sum.add(a.price), new Decimal(0))

      const lineTotal = unitPrice.add(addonsTotal).mul(item.quantity)

      return {
        menuItemId: item.menuItemId,
        variantId: item.variantId ?? null,
        variantName: variantName ?? null,
        quantity: item.quantity,
        notes: item.notes,
        unitPrice,
        totalPrice: lineTotal,
        addons: itemAddons,
      }
    })

    // Pricing calculations
    const subtotal = lineItems.reduce((sum, i) => sum.add(i.totalPrice), new Decimal(0))
    const discountAmt = this.calcDiscount(subtotal, dto.discount ?? 0, dto.discountType ?? "FLAT")
    const afterDiscount = subtotal.sub(discountAmt)
    const serviceChargeRate = new Decimal(dto.serviceChargePercent ?? 0).div(100)
    const serviceChargeAmt = afterDiscount.mul(serviceChargeRate).toDecimalPlaces(2)
    const gstRate = new Decimal(dto.gstRate ?? 5)
    const gstAmt = afterDiscount.add(serviceChargeAmt).mul(gstRate.div(100)).toDecimalPlaces(2)
    const total = afterDiscount.add(serviceChargeAmt).add(gstAmt)

    // Generate order number — timestamp + base-36 suffix for low collision probability.
    // Retry once on the rare P2002 unique constraint violation.
    const genNumber = () =>
      `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    const runTransaction = async (orderNumber: string) =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            restaurantId,
            branchId: dto.branchId,
            tableId: dto.tableId,
            customerId: dto.customerId ?? null,
            orderNumber,
            orderType: dto.orderType ?? OrderType.DINE_IN,
            notes: dto.notes,
            deliveryAddress: dto.deliveryAddress ?? null,
            subtotal,
            tax: gstAmt,
            discount: discountAmt,
            discountType: dto.discountType ?? "FLAT",
            serviceCharge: serviceChargeAmt,
            gstRate,
            gstAmount: gstAmt,
            total,
            paymentStatus: "UNPAID",
            createdById: userId || null,
            items: {
              create: lineItems.map((l) => ({
                menuItemId: l.menuItemId,
                variantId: l.variantId,
                variantName: l.variantName,
                quantity: l.quantity,
                notes: l.notes,
                unitPrice: l.unitPrice,
                totalPrice: l.totalPrice,
                addons: {
                  create: l.addons.map((a) => ({
                    addonId: a.addonId,
                    name: a.name,
                    price: a.price,
                  })),
                },
              })),
            },
          },
          include: {
            table: { select: { id: true, tableNumber: true } },
            branch: { select: { id: true, name: true } },
            customer: { select: { id: true, name: true, phone: true } },
            items: {
              include: {
                menuItem: { select: { id: true, name: true } },
                addons: true,
              },
            },
          },
        })

        if (dto.customerId) {
          await tx.customer.update({
            where: { id: dto.customerId },
            data: {
              totalOrders: { increment: 1 },
              totalSpent: { increment: total },
            },
          })
        }

        return created
      })

    let order: any
    try {
      order = await runTransaction(genNumber())
    } catch (err: any) {
      // P2002 = unique constraint violation — retry with a fresh number once
      if (err?.code === "P2002") {
        order = await runTransaction(genNumber())
      } else {
        throw err
      }
    }

    this.events.emitToBranch(dto.branchId, "order.created", {
      id: order.id,
      orderNumber: order.orderNumber,
      tableId: order.tableId,
      status: order.status,
      total: Number(order.total),
    })

    // Auto-generate KOT tickets for the new order (non-blocking — don't fail the order creation)
    this.kitchenService.generateKOTsForOrder(order.id, order.branchId).catch(() => {})

    return this.serializeOrder(order)
  }

  async updateStatus(restaurantId: string, id: string, dto: UpdateOrderStatusDto) {
    await this.assertOwner(restaurantId, id)
    const order = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: {
        table: { select: { id: true, tableNumber: true } },
        branch: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true } },
            addons: true,
          },
        },
      },
    })

    const statusPayload = { id: order.id, orderNumber: order.orderNumber, status: order.status }
    this.events.emitToBranch(order.branchId, "order.status_changed", statusPayload)
    this.events.emitToOrder(order.id, "order.status_changed", statusPayload)

    // Re-run KOT generation on CONFIRMED — idempotent, handles any items missed on create
    if (dto.status === "CONFIRMED") {
      this.kitchenService.generateKOTsForOrder(order.id, order.branchId).catch(() => {})
    }

    // Auto-deduct inventory when order is served or paid
    if (dto.status === "SERVED" || dto.status === "PAID") {
      this.inventoryService.deductForOrder(id).catch(() => {
        // Non-blocking — don't fail the status update if BOM deduction errors
      })
    }

    return this.serializeOrder(order)
  }

  async getReceipt(orderId: string, restaurantId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: { where: { status: "COMPLETED" } },
        restaurant: { select: { name: true } },
        branch: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
        table: { select: { tableNumber: true } },
      },
    })
    if (!order || order.restaurantId !== restaurantId) throw new NotFoundException("Order not found")
    return {
      ...order,
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      discount: Number(order.discount),
      serviceCharge: Number(order.serviceCharge),
      gstRate: Number(order.gstRate),
      gstAmount: Number(order.gstAmount),
      total: Number(order.total),
      items: order.items.map((i: any) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        totalPrice: Number(i.totalPrice),
      })),
      payments: order.payments.map((p: any) => ({ ...p, amount: Number(p.amount) })),
    }
  }

  async cancelPublicOrder(orderId: string, customerId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException("Order not found")
    if (order.customerId !== customerId) throw new ForbiddenException()

    // 2-minute cancellation window
    const ageMs = Date.now() - order.createdAt.getTime()
    if (ageMs > 2 * 60 * 1000) {
      throw new BadRequestException("Cancellation window has expired (2 minutes)")
    }

    if (order.status !== "PENDING") {
      throw new BadRequestException("Only PENDING orders can be cancelled")
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    })

    const payload = { id: updated.id, status: "CANCELLED" }
    this.events.emitToBranch(order.branchId, "order.cancelled", payload)
    this.events.emitToOrder(order.id, "order.cancelled", payload)

    return { success: true, status: "CANCELLED" }
  }

  async cancelOrder(restaurantId: string, id: string) {
    const order = await this.assertOwner(restaurantId, id)
    if (order.status === "PAID") {
      throw new BadRequestException("Cannot cancel a paid order")
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: {
        table: { select: { id: true, tableNumber: true } },
        branch: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true } },
            addons: true,
          },
        },
      },
    })

    const cancelPayload = { id: updated.id, orderNumber: updated.orderNumber, status: "CANCELLED" }
    this.events.emitToBranch(updated.branchId, "order.cancelled", cancelPayload)
    this.events.emitToOrder(updated.id, "order.cancelled", cancelPayload)

    return this.serializeOrder(updated)
  }

  private calcDiscount(subtotal: Decimal, discount: number, type: string): Decimal {
    if (!discount || discount <= 0) return new Decimal(0)
    if (type === "PERCENT") {
      return subtotal.mul(new Decimal(discount).div(100)).toDecimalPlaces(2)
    }
    return new Decimal(discount)
  }

  private async assertOwner(restaurantId: string, id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } })
    if (!order) throw new NotFoundException("Order not found")
    if (order.restaurantId !== restaurantId) throw new ForbiddenException()
    return order
  }

  private serializeOrder(order: any) {
    return {
      ...order,
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      discount: Number(order.discount),
      serviceCharge: Number(order.serviceCharge),
      gstRate: Number(order.gstRate),
      gstAmount: Number(order.gstAmount),
      total: Number(order.total),
      totalAmount: Number(order.total),
      tableNumber: order.table?.tableNumber ?? null,
      branchName: order.branch?.name ?? null,
      items: order.items?.map((i: any) => ({
        ...i,
        name: i.menuItem?.name ?? "",
        unitPrice: Number(i.unitPrice),
        totalPrice: Number(i.totalPrice),
        addons: i.addons?.map((a: any) => ({ ...a, price: Number(a.price) })) ?? [],
      })) ?? [],
      payments: order.payments?.map((p: any) => ({ ...p, amount: Number(p.amount) })) ?? [],
    }
  }
}
