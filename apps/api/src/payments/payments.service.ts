import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { PaymentStatus } from "@prisma/client"
import { CreatePaymentDto } from "./dto/create-payment.dto"
import { Decimal } from "@prisma/client/runtime/library"

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async listPayments(restaurantId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException("Order not found")
    if (order.restaurantId !== restaurantId) throw new ForbiddenException()

    const payments = await this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    })

    return payments.map(this.serialize)
  }

  async createPayment(restaurantId: string, dto: CreatePaymentDto) {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } })
    if (!order) throw new NotFoundException("Order not found")
    if (order.restaurantId !== restaurantId) throw new ForbiddenException()

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          orderId: dto.orderId,
          restaurantId,
          method: dto.method,
          amount: new Decimal(dto.amount),
          reference: dto.reference,
          status: "COMPLETED",
        },
      })

      // Sum all completed payments for this order
      const allPayments = await tx.payment.findMany({
        where: { orderId: dto.orderId, status: "COMPLETED" },
      })
      const totalPaid = allPayments.reduce(
        (sum, p) => sum.add(new Decimal(p.amount)),
        new Decimal(0),
      )

      const orderTotal = new Decimal(order.total)
      let paymentStatus = "PARTIAL"
      let orderStatus = order.status

      if (totalPaid.gte(orderTotal)) {
        paymentStatus = "PAID"
        orderStatus = "PAID"
      }

      await tx.order.update({
        where: { id: dto.orderId },
        data: { paymentStatus, status: orderStatus },
      })

      return created
    })

    return this.serialize(payment)
  }

  async refundPayment(restaurantId: string, id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } })
    if (!payment) throw new NotFoundException("Payment not found")
    if (payment.restaurantId !== restaurantId) throw new ForbiddenException()

    const refund = await this.prisma.$transaction(async (tx) => {
      // Mark original as refunded
      await tx.payment.update({ where: { id }, data: { status: "REFUNDED" } })

      // Create reverse payment record
      const refundRecord = await tx.payment.create({
        data: {
          orderId: payment.orderId,
          restaurantId,
          method: payment.method,
          amount: payment.amount,
          reference: `REFUND-${payment.id}`,
          status: "REFUNDED",
        },
      })

      // Recalculate payment status on the order
      const remaining = await tx.payment.findMany({
        where: { orderId: payment.orderId, status: "COMPLETED" },
      })
      const totalPaid = remaining.reduce(
        (sum, p) => sum.add(new Decimal(p.amount)),
        new Decimal(0),
      )

      const order = await tx.order.findUnique({ where: { id: payment.orderId } })
      const orderTotal = new Decimal(order!.total)

      let paymentStatus = "UNPAID"
      if (totalPaid.gt(0) && totalPaid.lt(orderTotal)) paymentStatus = "PARTIAL"
      if (totalPaid.gte(orderTotal)) paymentStatus = "PAID"

      await tx.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus },
      })

      return refundRecord
    })

    return this.serialize(refund)
  }

  private serialize(p: any) {
    return { ...p, amount: Number(p.amount) }
  }
}
