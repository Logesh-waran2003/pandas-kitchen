import { NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common"
import { PaymentsService } from "./payments.service"
import { Decimal } from "@prisma/client/runtime/library"

function makeEventGateway() {
  return { emitToBranch: jest.fn(), emitToOrder: jest.fn() }
}

function makeTx() {
  return {
    payment: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    order: { findUnique: jest.fn(), update: jest.fn() },
  }
}

function makePrisma(tx: ReturnType<typeof makeTx>) {
  return {
    order: { findUnique: jest.fn() },
    payment: { findUnique: jest.fn() },
    $transaction: jest.fn().mockImplementation((cb: (tx: any) => any) => cb(tx)),
  }
}

const RESTAURANT_ID = "rest-1"
const ORDER_ID = "order-1"
const PAYMENT_ID = "pay-1"

describe("PaymentsService", () => {
  let service: PaymentsService
  let prisma: ReturnType<typeof makePrisma>
  let tx: ReturnType<typeof makeTx>
  let events: ReturnType<typeof makeEventGateway>

  beforeEach(() => {
    tx = makeTx()
    prisma = makePrisma(tx)
    events = makeEventGateway()
    service = new PaymentsService(prisma as any, events as any)
  })

  describe("createPayment", () => {
    function setupOrder(total: number) {
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        restaurantId: RESTAURANT_ID,
        branchId: "branch-1",
        status: "PENDING",
        total: new Decimal(total),
      })
    }

    function setupTxPayment(amount: number, id = PAYMENT_ID) {
      const payment = {
        id,
        orderId: ORDER_ID,
        restaurantId: RESTAURANT_ID,
        method: "CASH",
        amount: new Decimal(amount),
        reference: null,
        status: "COMPLETED",
        createdAt: new Date(),
      }
      tx.payment.create.mockResolvedValue(payment)
      tx.payment.findMany.mockResolvedValue([payment])
      tx.order.update.mockResolvedValue({})
      return payment
    }

    it("amount equals order total → paymentStatus PAID, orderStatus PAID", async () => {
      setupOrder(100)
      setupTxPayment(100)

      await service.createPayment(RESTAURANT_ID, {
        orderId: ORDER_ID,
        method: "CASH",
        amount: 100,
      })

      expect(tx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ORDER_ID },
          data: expect.objectContaining({ paymentStatus: "PAID", status: "PAID" }),
        })
      )
    })

    it("amount less than order total → paymentStatus PARTIAL", async () => {
      setupOrder(100)
      // Only 60 paid of 100
      const payment = {
        id: PAYMENT_ID,
        orderId: ORDER_ID,
        restaurantId: RESTAURANT_ID,
        method: "CASH",
        amount: new Decimal(60),
        reference: null,
        status: "COMPLETED",
        createdAt: new Date(),
      }
      tx.payment.create.mockResolvedValue(payment)
      tx.payment.findMany.mockResolvedValue([payment])
      tx.order.update.mockResolvedValue({})

      await service.createPayment(RESTAURANT_ID, {
        orderId: ORDER_ID,
        method: "CASH",
        amount: 60,
      })

      expect(tx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentStatus: "PARTIAL" }),
        })
      )
    })

    it("order not found → throws NotFoundException", async () => {
      prisma.order.findUnique.mockResolvedValue(null)

      await expect(
        service.createPayment(RESTAURANT_ID, { orderId: "bad-id", method: "CASH", amount: 100 })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe("refundPayment", () => {
    it("already refunded → throws BadRequestException", async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: PAYMENT_ID,
        restaurantId: RESTAURANT_ID,
        status: "REFUNDED",
        orderId: ORDER_ID,
        method: "CASH",
        amount: new Decimal(100),
      })

      await expect(service.refundPayment(RESTAURANT_ID, PAYMENT_ID)).rejects.toThrow(
        BadRequestException
      )
    })

    it("valid payment → creates REFUNDED record with REFUND- reference prefix", async () => {
      const payment = {
        id: PAYMENT_ID,
        restaurantId: RESTAURANT_ID,
        status: "COMPLETED",
        orderId: ORDER_ID,
        method: "CASH",
        amount: new Decimal(100),
      }
      prisma.payment.findUnique.mockResolvedValue(payment)
      tx.payment.update.mockResolvedValue({})
      tx.payment.create.mockResolvedValue({ ...payment, status: "REFUNDED", reference: `REFUND-${PAYMENT_ID}` })
      tx.payment.findMany.mockResolvedValue([]) // 0 completed after refund
      tx.order.findUnique.mockResolvedValue({ id: ORDER_ID, total: new Decimal(100) })
      tx.order.update.mockResolvedValue({})

      await service.refundPayment(RESTAURANT_ID, PAYMENT_ID)

      expect(tx.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "REFUNDED",
            reference: `REFUND-${PAYMENT_ID}`,
          }),
        })
      )
    })

    it("payment not found → throws NotFoundException", async () => {
      prisma.payment.findUnique.mockResolvedValue(null)

      await expect(service.refundPayment(RESTAURANT_ID, "bad-id")).rejects.toThrow(NotFoundException)
    })
  })
})
