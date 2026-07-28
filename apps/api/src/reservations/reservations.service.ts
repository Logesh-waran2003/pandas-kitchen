import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { EventsGateway } from "../events/events.gateway"
import { ReservationStatus } from "@prisma/client"
import { CreateReservationDto, UpdateReservationDto } from "./dto/reservation.dto"

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  async listReservations(restaurantId: string, branchId?: string, date?: string, status?: string) {
    const where: any = { restaurantId }

    if (branchId) where.branchId = branchId
    if (status) where.status = status as ReservationStatus

    if (date) {
      const start = new Date(date)
      const end = new Date(date)
      end.setDate(end.getDate() + 1)
      where.date = { gte: start, lt: end }
    }

    return this.prisma.reservation.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        table: { select: { id: true, tableNumber: true } },
      },
      orderBy: { date: "asc" },
    })
  }

  async getReservation(restaurantId: string, id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        table: { select: { id: true, tableNumber: true } },
      },
    })
    if (!reservation) throw new NotFoundException("Reservation not found")
    if (reservation.restaurantId !== restaurantId) throw new ForbiddenException()
    return reservation
  }

  async createReservation(restaurantId: string, dto: CreateReservationDto) {
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } })
    if (!branch || branch.restaurantId !== restaurantId) {
      throw new ForbiddenException("Branch not found or access denied")
    }

    return this.prisma.reservation.create({
      data: {
        restaurantId,
        branchId: dto.branchId,
        tableId: dto.tableId ?? null,
        customerName: dto.customerName,
        phone: dto.phone,
        partySize: dto.partySize,
        date: new Date(dto.date),
        notes: dto.notes ?? null,
      },
      include: {
        branch: { select: { id: true, name: true } },
        table: { select: { id: true, tableNumber: true } },
      },
    })
  }

  async updateReservation(restaurantId: string, id: string, dto: UpdateReservationDto) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } })
    if (!reservation) throw new NotFoundException("Reservation not found")
    if (reservation.restaurantId !== restaurantId) throw new ForbiddenException()

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status as ReservationStatus }),
        ...(dto.tableId !== undefined && { tableId: dto.tableId }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
      },
      include: {
        branch: { select: { id: true, name: true } },
        table: { select: { id: true, tableNumber: true } },
      },
    })

    // Emit socket event when a guest is seated
    if (dto.status === "SEATED") {
      this.events.emitToRoom(
        `branch:${updated.branchId}`,
        "reservation.seated",
        { reservationId: updated.id, tableId: updated.tableId },
      )
    }

    return updated
  }

  async deleteReservation(restaurantId: string, id: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } })
    if (!reservation) throw new NotFoundException("Reservation not found")
    if (reservation.restaurantId !== restaurantId) throw new ForbiddenException()

    await this.prisma.reservation.delete({ where: { id } })
    return { success: true }
  }
}
