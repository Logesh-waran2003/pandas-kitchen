import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { EventsGateway } from "../events/events.gateway"
import { OpenShiftDto, CloseShiftDto } from "./dto/shifts.dto"
import { Decimal } from "@prisma/client/runtime/library"

@Injectable()
export class ShiftsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  async getActiveShift(restaurantId: string, branchId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { restaurantId, branchId, status: "OPEN" },
      include: {
        openedBy: { select: { id: true, name: true } },
      },
      orderBy: { openedAt: "desc" },
    })
    return shift ? this.serialize(shift) : null
  }

  async listShifts(restaurantId: string, branchId: string) {
    const shifts = await this.prisma.shift.findMany({
      where: { restaurantId, branchId },
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
      },
      orderBy: { openedAt: "desc" },
      take: 30,
    })
    return shifts.map(this.serialize)
  }

  async openShift(restaurantId: string, userId: string, dto: OpenShiftDto) {
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } })
    if (!branch || branch.restaurantId !== restaurantId) {
      throw new ForbiddenException("Branch not found or access denied")
    }

    // Check for already open shift
    const existing = await this.prisma.shift.findFirst({
      where: { restaurantId, branchId: dto.branchId, status: "OPEN" },
    })
    if (existing) {
      throw new ConflictException("A shift is already open for this branch")
    }

    const shift = await this.prisma.shift.create({
      data: {
        restaurant: { connect: { id: restaurantId } },
        branch: { connect: { id: dto.branchId } },
        openedBy: { connect: { id: userId } },
        openingFloat: dto.openingFloat ?? 0,
        notes: dto.notes,
        status: "OPEN",
      },
      include: {
        openedBy: { select: { id: true, name: true } },
      },
    })

    const serialized = this.serialize(shift)
    this.events.emitToBranch(dto.branchId, "shift.opened", { id: shift.id, branchId: dto.branchId })
    return serialized
  }

  async closeShift(restaurantId: string, userId: string, shiftId: string, dto: CloseShiftDto) {
    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId } })
    if (!shift) throw new NotFoundException("Shift not found")
    if (shift.restaurantId !== restaurantId) throw new ForbiddenException()
    if (shift.status === "CLOSED") throw new ConflictException("Shift is already closed")

    // Calculate shift summary — total cash collected during this shift
    const payments = await this.prisma.payment.findMany({
      where: {
        restaurantId,
        createdAt: { gte: shift.openedAt },
        status: "COMPLETED",
      },
    })
    const totalCollected = payments.reduce(
      (sum, p) => sum.add(new Decimal(p.amount)),
      new Decimal(0),
    )
    const cashCollected = payments
      .filter(p => p.method === "CASH")
      .reduce((sum, p) => sum.add(new Decimal(p.amount)), new Decimal(0))

    const closed = await this.prisma.shift.update({
      where: { id: shiftId },
      data: {
        status: "CLOSED",
        closedById: userId,
        closedAt: new Date(),
        closingFloat: dto.closingFloat ?? null,
        notes: dto.notes ?? shift.notes,
      },
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
      },
    })

    this.events.emitToBranch(shift.branchId, "shift.closed", { id: shiftId, branchId: shift.branchId })

    return {
      ...this.serialize(closed),
      summary: {
        totalCollected: Number(totalCollected),
        cashCollected: Number(cashCollected),
        otherCollected: Number(totalCollected.sub(cashCollected)),
        openingFloat: Number(shift.openingFloat),
        closingFloat: dto.closingFloat ?? null,
        cashVariance: dto.closingFloat != null
          ? dto.closingFloat - Number(cashCollected) - Number(shift.openingFloat)
          : null,
        transactionCount: payments.length,
      },
    }
  }

  async getShiftSummary(restaurantId: string, shiftId: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
      },
    })
    if (!shift) throw new NotFoundException("Shift not found")
    if (shift.restaurantId !== restaurantId) throw new ForbiddenException()

    const endTime = shift.closedAt ?? new Date()
    const payments = await this.prisma.payment.findMany({
      where: {
        restaurantId,
        createdAt: { gte: shift.openedAt, lte: endTime },
        status: "COMPLETED",
      },
    })

    const orderCount = await this.prisma.order.count({
      where: {
        restaurantId,
        createdAt: { gte: shift.openedAt, lte: endTime },
        status: { not: "CANCELLED" },
      },
    })

    const byMethod: Record<string, number> = {}
    for (const p of payments) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount)
    }

    return {
      shift: this.serialize(shift),
      summary: {
        orderCount,
        transactionCount: payments.length,
        totalCollected: payments.reduce((s, p) => s + Number(p.amount), 0),
        byMethod,
        openingFloat: Number(shift.openingFloat),
        closingFloat: shift.closingFloat ? Number(shift.closingFloat) : null,
      },
    }
  }

  private serialize(s: any) {
    return {
      ...s,
      openingFloat: Number(s.openingFloat),
      closingFloat: s.closingFloat != null ? Number(s.closingFloat) : null,
    }
  }
}
