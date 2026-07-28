import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { EventsGateway } from "../events/events.gateway"
import { KOTStatus, KOTItemStatus } from "@prisma/client"
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateKOTDto,
  UpdateKOTStatusDto,
  UpdateKOTItemStatusDto,
} from "./dto/kitchen.dto"

@Injectable()
export class KitchenService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  // ── Departments ──────────────────────────────────────────────────────────────

  async listDepartments(restaurantId: string, branchId: string) {
    return this.prisma.department.findMany({
      where: { restaurantId, branchId },
      orderBy: { createdAt: "asc" },
    })
  }

  async createDepartment(restaurantId: string, dto: CreateDepartmentDto) {
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } })
    if (!branch || branch.restaurantId !== restaurantId) {
      throw new ForbiddenException("Branch not found or access denied")
    }

    return this.prisma.department.create({
      data: { restaurantId, branchId: dto.branchId, name: dto.name },
    })
  }

  async updateDepartment(restaurantId: string, id: string, dto: UpdateDepartmentDto) {
    const dept = await this.prisma.department.findUnique({ where: { id } })
    if (!dept) throw new NotFoundException("Department not found")
    if (dept.restaurantId !== restaurantId) throw new ForbiddenException()

    return this.prisma.department.update({ where: { id }, data: dto })
  }

  async deleteDepartment(restaurantId: string, id: string) {
    const dept = await this.prisma.department.findUnique({ where: { id } })
    if (!dept) throw new NotFoundException("Department not found")
    if (dept.restaurantId !== restaurantId) throw new ForbiddenException()

    await this.prisma.department.update({ where: { id }, data: { isActive: false } })
    return { success: true }
  }

  // ── KOT Tickets ──────────────────────────────────────────────────────────────

  async listKOT(restaurantId: string, branchId: string, status?: string) {
    const where: any = { branchId, branch: { restaurantId } }
    if (status) where.status = status as KOTStatus

    const tickets = await this.prisma.kOTTicket.findMany({
      where,
      include: {
        order: { select: { id: true, orderNumber: true } },
        items: {
          include: {
            orderItem: {
              include: { menuItem: { select: { id: true, name: true } } },
            },
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return tickets
  }

  async getKOT(restaurantId: string, id: string) {
    const ticket = await this.prisma.kOTTicket.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, orderNumber: true } },
        branch: { select: { id: true, name: true } },
        items: {
          include: {
            orderItem: {
              include: {
                menuItem: { select: { id: true, name: true } },
                addons: true,
              },
            },
            department: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!ticket) throw new NotFoundException("KOT ticket not found")

    const branch = await this.prisma.branch.findUnique({ where: { id: ticket.branchId } })
    if (!branch || branch.restaurantId !== restaurantId) throw new ForbiddenException()

    return ticket
  }

  // ── Auto KOT generation ──────────────────────────────────────────────────────

  async generateKOTsForOrder(orderId: string, branchId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { menuItem: { select: { id: true, departmentId: true } } },
        },
      },
    })
    if (!order || order.items.length === 0) return

    // Batch-check which items already have a KOT item (idempotency)
    const existing = await this.prisma.kOTItem.findMany({
      where: { orderItemId: { in: order.items.map((i) => i.id) } },
      select: { orderItemId: true },
    })
    const alreadyKotted = new Set(existing.map((k) => k.orderItemId))

    const newItems = order.items.filter((i) => !alreadyKotted.has(i.id))
    if (newItems.length === 0) return

    // Group by departmentId (null items go to 'general' bucket → single KOT)
    const byDept: Record<string, typeof newItems> = {}
    for (const item of newItems) {
      const key = item.menuItem?.departmentId ?? "general"
      if (!byDept[key]) byDept[key] = []
      byDept[key].push(item)
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "")

    for (const [deptId, items] of Object.entries(byDept)) {
      if (items.length === 0) continue
      const rand = String(Math.floor(1000 + Math.random() * 9000))
      const ticketNumber = `KOT-${dateStr}-${rand}`

      const ticket = await this.prisma.kOTTicket.create({
        data: {
          orderId,
          branchId,
          ticketNumber,
          items: {
            create: items.map((item) => ({
              orderItemId: item.id,
              departmentId: deptId !== "general" ? deptId : null,
            })),
          },
        },
        include: {
          order: { select: { id: true, orderNumber: true } },
          items: {
            include: {
              orderItem: {
                include: { menuItem: { select: { id: true, name: true } } },
              },
              department: { select: { id: true, name: true } },
            },
          },
        },
      })

      this.events.emitToKitchen(ticket.branchId, "kot.created", ticket)
    }
  }

  async createKOT(restaurantId: string, dto: CreateKOTDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        items: {
          include: { menuItem: { select: { id: true, departmentId: true } } },
        },
      },
    })

    if (!order) throw new NotFoundException("Order not found")
    if (order.restaurantId !== restaurantId) throw new ForbiddenException()

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "")
    const rand = String(Math.floor(1000 + Math.random() * 9000))
    const ticketNumber = `KOT-${dateStr}-${rand}`

    const ticket = await this.prisma.kOTTicket.create({
      data: {
        orderId: dto.orderId,
        branchId: order.branchId,
        ticketNumber,
        items: {
          create: order.items.map((item) => ({
            orderItemId: item.id,
            departmentId: item.menuItem.departmentId ?? null,
          })),
        },
      },
      include: {
        order: { select: { id: true, orderNumber: true } },
        items: {
          include: {
            orderItem: {
              include: { menuItem: { select: { id: true, name: true } } },
            },
            department: { select: { id: true, name: true } },
          },
        },
      },
    })

    this.events.emitToKitchen(ticket.branchId, "kot.created", ticket)

    return ticket
  }

  async updateKOTStatus(restaurantId: string, id: string, dto: UpdateKOTStatusDto) {
    const ticket = await this.prisma.kOTTicket.findUnique({ where: { id } })
    if (!ticket) throw new NotFoundException("KOT ticket not found")

    const branch = await this.prisma.branch.findUnique({ where: { id: ticket.branchId } })
    if (!branch || branch.restaurantId !== restaurantId) throw new ForbiddenException()

    const updatedTicket = await this.prisma.kOTTicket.update({
      where: { id },
      data: { status: dto.status as KOTStatus },
    })

    this.events.emitToKitchen(updatedTicket.branchId, "kot.status_changed", {
      id: updatedTicket.id,
      status: updatedTicket.status,
    })

    return updatedTicket
  }

  async updateKOTItemStatus(restaurantId: string, itemId: string, dto: UpdateKOTItemStatusDto) {
    const item = await this.prisma.kOTItem.findUnique({
      where: { id: itemId },
      include: { kotTicket: { include: { branch: true } } },
    })
    if (!item) throw new NotFoundException("KOT item not found")
    if (item.kotTicket.branch.restaurantId !== restaurantId) throw new ForbiddenException()

    const data: any = { status: dto.status as KOTItemStatus }
    if (dto.status === "PREPARING") data.startedAt = new Date()
    if (dto.status === "DONE") data.completedAt = new Date()

    const updatedItem = await this.prisma.kOTItem.update({ where: { id: itemId }, data })

    this.events.emitToKitchen(item.kotTicket.branchId, "kot.item_updated", {
      kotId: updatedItem.kotTicketId,
      itemId: updatedItem.id,
      status: updatedItem.status,
    })

    return updatedItem
  }
}
