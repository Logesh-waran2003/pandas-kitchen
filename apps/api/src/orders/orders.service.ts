import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common"
import { randomUUID } from "crypto"
import { PrismaService } from "../prisma/prisma.service"
import { EventsGateway } from "../events/events.gateway"
import { InventoryService } from "../inventory/inventory.service"
import { KitchenService } from "../kitchen/kitchen.service"
import { CreateOrderDto } from "./dto/create-order.dto"
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto"
import { EditOrderDto } from "./dto/edit-order.dto"
import { OrderStatus, OrderType, OrderSource } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
    private inventoryService: InventoryService,
    private kitchenService: KitchenService,
  ) {}

  async listOrders(
    restaurantId: string,
    branchId?: string,
    status?: string,
    date?: string,
    page?: number,
    limit?: number,
    orderType?: string,
    orderSource?: string,
  ) {
    const pageNum = page && page > 0 ? page : 1
    const limitNum = Math.min(limit && limit > 0 ? limit : 20, 100)
    const skip = (pageNum - 1) * limitNum

    const where: any = { restaurantId }

    if (branchId) where.branchId = branchId
    if (status) where.status = status as OrderStatus
    if (orderType) where.orderType = orderType as OrderType
    if (orderSource) where.orderSource = orderSource as OrderSource

    if (date) {
      const start = new Date(date)
      const end = new Date(date)
      end.setDate(end.getDate() + 1)
      where.createdAt = { gte: start, lt: end }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
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
        skip,
        take: limitNum,
      }),
      this.prisma.order.count({ where }),
    ])

    return {
      data: orders.map(this.serializeOrder),
      meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    }
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

    // Show pickup code from CONFIRMED onwards so customer can present it early
    const pickupCodeStatuses: string[] = ["CONFIRMED", "PREPARING", "READY", "SERVED", "PAID"]
    const showPickupCode =
      order.orderType === OrderType.TAKEAWAY && pickupCodeStatuses.includes(order.status as string)

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      orderType: order.orderType,
      orderSource: order.orderSource,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      deliveryFee: Number(order.deliveryFee),
      packagingFee: Number(order.packagingFee),
      tip: Number(order.tip),
      couponDiscount: Number(order.couponDiscount),
      scheduledFor: order.scheduledFor,
      pickupCode: showPickupCode ? order.pickupCode : null,
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

    // Validate customer if provided, or auto-create from name+phone
    let resolvedCustomerId = dto.customerId
    if (!resolvedCustomerId && dto.customerPhone) {
      const existing = await this.prisma.customer.findUnique({
        where: { restaurantId_phone: { restaurantId, phone: dto.customerPhone } },
      })
      if (existing) {
        resolvedCustomerId = existing.id
      } else if (dto.customerName) {
        const created = await this.prisma.customer.create({
          data: {
            restaurantId,
            name: dto.customerName,
            phone: dto.customerPhone,
            email: (dto as any).customerEmail ?? null,
          },
        })
        resolvedCustomerId = created.id
      }
    } else if (resolvedCustomerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: resolvedCustomerId } })
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

    const deliveryFee = new Decimal(dto.deliveryFee ?? 0)
    const packagingFee = new Decimal(dto.packagingFee ?? 0)
    const tip = new Decimal(dto.tip ?? 0)

    // Validate coupon if provided
    let couponRecord: any = null
    let couponDiscount = new Decimal(0)
    if (dto.couponCode) {
      const result = await this.validateCoupon(restaurantId, dto.couponCode, Number(subtotal))
      if (!result.valid) {
        throw new BadRequestException(result.message)
      }
      couponRecord = result.coupon
      couponDiscount = new Decimal(result.discountAmount)
    }

    const total = afterDiscount
      .add(serviceChargeAmt)
      .add(gstAmt)
      .add(deliveryFee)
      .add(packagingFee)
      .add(tip)
      .sub(couponDiscount)
      .toDecimalPlaces(2)

    // Generate pickup code for TAKEAWAY orders
    const pickupCode =
      dto.orderType === OrderType.TAKEAWAY
        ? Array.from({ length: 6 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]).join("")
        : null

    // Generate order number — timestamp + 8 hex chars of UUID randomness (BUG-07).
    // Collision probability is effectively zero; retry once on the rare P2002 just in case.
    const genNumber = () =>
      `ORD-${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`

    const runTransaction = async (orderNumber: string) =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            restaurantId,
            branchId: dto.branchId,
            tableId: dto.tableId,
            customerId: resolvedCustomerId ?? null,
            orderNumber,
            orderType: dto.orderType ?? OrderType.DINE_IN,
            orderSource: (dto.orderSource as OrderSource) ?? OrderSource.QR_TABLE,
            paxCount: dto.paxCount ?? 1,
            notes: dto.notes,
            deliveryAddress: dto.deliveryAddress ?? null,
            scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
            subtotal,
            tax: gstAmt,
            discount: discountAmt,
            discountType: dto.discountType ?? "FLAT",
            serviceCharge: serviceChargeAmt,
            gstRate,
            gstAmount: gstAmt,
            deliveryFee,
            packagingFee,
            tip,
            couponId: couponRecord?.id ?? null,
            couponDiscount,
            total,
            paymentStatus: "UNPAID",
            pickupCode,
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

        // Create CouponUsage record if coupon was applied
        if (couponRecord) {
          await tx.couponUsage.create({
            data: {
              couponId: couponRecord.id,
              customerId: dto.customerId ?? null,
              orderId: created.id,
            },
          })
          await tx.coupon.update({
            where: { id: couponRecord.id },
            data: { usedCount: { increment: 1 } },
          })
        }

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

    // Update table status to OCCUPIED when order is placed at a table
    if (dto.tableId) {
      await this.prisma.table.update({
        where: { id: dto.tableId },
        data: { status: "OCCUPIED" },
      })
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

  async getCustomerOrders(customerId: string, limit = 20) {
    const orders = await this.prisma.order.findMany({
      where: { customerId },
      include: {
        branch: { select: { id: true, name: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 50),
    })
    return orders.map(this.serializeOrder)
  }

  async validateCoupon(restaurantId: string, code: string, subtotal: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { restaurantId_code: { restaurantId, code } },
    })

    if (!coupon) return { valid: false, coupon: null, discountAmount: 0, message: "Coupon not found" }
    if (!coupon.isActive) return { valid: false, coupon: null, discountAmount: 0, message: "Coupon is inactive" }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return { valid: false, coupon: null, discountAmount: 0, message: "Coupon has expired" }
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, coupon: null, discountAmount: 0, message: "Coupon usage limit reached" }
    }
    if (subtotal < Number(coupon.minOrderValue)) {
      return {
        valid: false,
        coupon: null,
        discountAmount: 0,
        message: `Minimum order value of ${Number(coupon.minOrderValue)} required`,
      }
    }

    let discountAmount: number
    if (coupon.discountType === "PERCENT") {
      discountAmount = Math.min((subtotal * Number(coupon.discountValue)) / 100, subtotal)
    } else {
      discountAmount = Math.min(Number(coupon.discountValue), subtotal)
    }

    return { valid: true, coupon, discountAmount, message: "Coupon applied" }
  }

  async updateStatus(restaurantId: string, id: string, dto: UpdateOrderStatusDto) {
    await this.assertOwner(restaurantId, id)

    // OUT_FOR_DELIVERY is only valid for DELIVERY orders
    if (dto.status === "OUT_FOR_DELIVERY") {
      const existing = await this.prisma.order.findUnique({ where: { id }, select: { orderType: true } })
      if (existing?.orderType !== OrderType.DELIVERY) {
        throw new BadRequestException("OUT_FOR_DELIVERY status is only valid for DELIVERY orders")
      }
    }

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

    const statusPayload = { id: order.id, orderNumber: order.orderNumber, status: order.status, orderType: order.orderType }
    this.events.emitToBranch(order.branchId, "order.status_changed", statusPayload)
    this.events.emitToOrder(order.id, "order.status_changed", statusPayload)

    // Re-run KOT generation on CONFIRMED — idempotent, handles any items missed on create
    if (dto.status === "CONFIRMED") {
      this.kitchenService.generateKOTsForOrder(order.id, order.branchId).catch(() => {})
    }

    // Auto-deduct inventory when order is served or paid
    if (dto.status === "SERVED" || dto.status === "PAID") {
      this.inventoryService.deductForOrder(id).catch(() => {})
    }

    // Loyalty points on PAID (totalOrders + totalSpent already incremented at order creation)
    if (dto.status === "PAID" && order.customerId) {
      const pointsEarned = Math.floor(Number(order.total) / 10)
      this.prisma.customer.update({
        where: { id: order.customerId },
        data: {
          loyaltyPoints: { increment: pointsEarned },
        },
      }).catch(() => {})
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

  async submitRating(orderId: string, rating: number, customerId: string) {
    if (!rating || rating < 1 || rating > 5) throw new BadRequestException('Rating must be 1-5')
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('Order not found')
    if (order.customerId !== customerId) throw new ForbiddenException()
    if (!['SERVED', 'PAID'].includes(order.status as string)) {
      throw new BadRequestException('Can only rate served or paid orders')
    }
    if (order.rating) throw new BadRequestException('Already rated')
    await this.prisma.order.update({ where: { id: orderId }, data: { rating } })
    return { success: true }
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

    // Restore inventory if it was already deducted (order was SERVED before cancellation)
    if (order.status === "SERVED") {
      this.inventoryService.restoreForOrder(id).catch(() => {})
    }

    return this.serializeOrder(updated)
  }

  async editOrder(restaurantId: string, id: string, dto: EditOrderDto) {
    const order = await this.assertOwner(restaurantId, id)
    if (!['PENDING', 'CONFIRMED'].includes(order.status as string)) {
      throw new BadRequestException('Can only edit PENDING or CONFIRMED orders')
    }
    if (dto.items.length === 0) {
      throw new BadRequestException('Order must have at least one item')
    }

    // Fetch menu item prices
    const menuItemIds = dto.items.map((i) => i.menuItemId)
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, price: true },
    })
    const priceMap = new Map(menuItems.map((m) => [m.id, m.price]))

    // Delete KOTItems first (FK constraint), then OrderItems
    const existingItems = await this.prisma.orderItem.findMany({ where: { orderId: id }, select: { id: true } })
    const itemIds = existingItems.map((i) => i.id)
    await this.prisma.kOTItem.deleteMany({ where: { orderItemId: { in: itemIds } } })
    await this.prisma.orderItemAddon.deleteMany({ where: { orderItemId: { in: itemIds } } })
    await this.prisma.orderItem.deleteMany({ where: { orderId: id } })

    // Recalculate totals
    let subtotal = new Decimal(0)
    const newItems = dto.items.map((item) => {
      const price = priceMap.get(item.menuItemId) ?? new Decimal(0)
      const lineTotal = new Decimal(price).mul(item.quantity)
      subtotal = subtotal.add(lineTotal)
      return {
        orderId: id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: price,
        totalPrice: lineTotal,
        notes: item.notes ?? null,
      }
    })

    const gstRate = new Decimal(order.gstRate)
    const gstAmount = subtotal.mul(gstRate).div(100).toDecimalPlaces(2)
    const total = subtotal.add(gstAmount)

    await this.prisma.orderItem.createMany({ data: newItems })

    const updated = await this.prisma.order.update({
      where: { id },
      data: { subtotal, gstAmount, total },
      include: {
        table: { select: { id: true, tableNumber: true } },
        branch: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        items: { include: { menuItem: { select: { id: true, name: true } }, addons: true } },
        payments: true,
      },
    })

    this.events.emitToBranch(order.branchId, 'order.updated', { id: updated.id, orderNumber: updated.orderNumber })
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
      paxCount: order.paxCount ?? 1,
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
