import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { CreateCustomerDto } from "./dto/create-customer.dto"
import { UpdateCustomerDto } from "./dto/update-customer.dto"

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async listCustomers(restaurantId: string, search?: string) {
    const where: any = { restaurantId, isActive: true }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ]
    }

    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    return customers.map(this.serialize)
  }

  async getCustomer(restaurantId: string, id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } })
    if (!customer) throw new NotFoundException("Customer not found")
    if (customer.restaurantId !== restaurantId) throw new ForbiddenException()
    return this.serialize(customer)
  }

  async getCustomerOrders(restaurantId: string, id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } })
    if (!customer) throw new NotFoundException("Customer not found")
    if (customer.restaurantId !== restaurantId) throw new ForbiddenException()

    const orders = await this.prisma.order.findMany({
      where: { customerId: id, restaurantId },
      include: {
        table: { select: { id: true, tableNumber: true } },
        branch: { select: { id: true, name: true } },
        items: { include: { menuItem: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    })

    return orders.map((o) => ({
      ...o,
      subtotal: Number(o.subtotal),
      tax: Number(o.tax),
      total: Number(o.total),
      discount: Number(o.discount),
      serviceCharge: Number(o.serviceCharge),
      gstAmount: Number(o.gstAmount),
      items: o.items.map((i: any) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        totalPrice: Number(i.totalPrice),
      })),
    }))
  }

  async createCustomer(restaurantId: string, dto: CreateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({
      where: { restaurantId_phone: { restaurantId, phone: dto.phone } },
    })
    if (existing) {
      throw new ConflictException("A customer with this phone number already exists")
    }

    const customer = await this.prisma.customer.create({
      data: { restaurantId, ...dto },
    })
    return this.serialize(customer)
  }

  async updateCustomer(restaurantId: string, id: string, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id } })
    if (!customer) throw new NotFoundException("Customer not found")
    if (customer.restaurantId !== restaurantId) throw new ForbiddenException()

    // If phone is changing, check uniqueness
    if (dto.phone && dto.phone !== customer.phone) {
      const conflict = await this.prisma.customer.findUnique({
        where: { restaurantId_phone: { restaurantId, phone: dto.phone } },
      })
      if (conflict) throw new ConflictException("A customer with this phone number already exists")
    }

    const updated = await this.prisma.customer.update({ where: { id }, data: dto })
    return this.serialize(updated)
  }

  async deleteCustomer(restaurantId: string, id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } })
    if (!customer) throw new NotFoundException("Customer not found")
    if (customer.restaurantId !== restaurantId) throw new ForbiddenException()

    await this.prisma.customer.update({ where: { id }, data: { isActive: false } })
    return { success: true }
  }

  private serialize(c: any) {
    return {
      ...c,
      totalSpent: Number(c.totalSpent),
    }
  }
}
