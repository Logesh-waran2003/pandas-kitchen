import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import * as bcrypt from "bcryptjs"
import { PrismaService } from "../prisma/prisma.service"
import { CreateCustomerDto } from "./dto/create-customer.dto"
import { UpdateCustomerDto } from "./dto/update-customer.dto"
import { CustomerRegisterDto, CustomerLoginDto, AddAddressDto } from "./dto/customer-auth.dto"

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

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
      totalAmount: Number(o.total),
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

  async registerCustomer(restaurantId: string, dto: CustomerRegisterDto) {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set')
    // Guard: ensure restaurant exists
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } })
    if (!restaurant) throw new NotFoundException("Restaurant not found")

    const existing = await this.prisma.customer.findUnique({
      where: { restaurantId_phone: { restaurantId, phone: dto.phone } },
    })
    if (existing) throw new ConflictException("A customer with this phone number already exists")

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const customer = await this.prisma.customer.create({
      data: { restaurantId, name: dto.name, phone: dto.phone, email: dto.email, passwordHash },
    })

    const token = this.jwt.sign(
      { sub: customer.id, restaurantId, role: "CUSTOMER" },
      { secret: process.env.JWT_SECRET, expiresIn: "30d" },
    )

    return { customer: this.serialize(customer), token }
  }

  async loginCustomer(restaurantId: string, dto: CustomerLoginDto) {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set')
    const customer = await this.prisma.customer.findUnique({
      where: { restaurantId_phone: { restaurantId, phone: dto.phone } },
    })

    if (!customer || !customer.passwordHash) {
      throw new UnauthorizedException("Invalid credentials")
    }

    const valid = await bcrypt.compare(dto.password, customer.passwordHash)
    if (!valid) throw new UnauthorizedException("Invalid credentials")

    if (!customer.isActive) throw new UnauthorizedException("Account is inactive")

    const token = this.jwt.sign(
      { sub: customer.id, restaurantId, role: "CUSTOMER" },
      { secret: process.env.JWT_SECRET, expiresIn: "30d" },
    )

    return { customer: this.serialize(customer), token }
  }

  async addAddress(customerId: string, dto: AddAddressDto) {
    if (dto.isDefault) {
      // Clear existing defaults for this customer
      await this.prisma.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      })
    }

    return this.prisma.customerAddress.create({
      data: {
        customerId,
        label: dto.label ?? "Home",
        address: dto.address,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        isDefault: dto.isDefault ?? false,
      },
    })
  }

  async getAddresses(customerId: string) {
    return this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    })
  }

  async deleteAddress(customerId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findUnique({ where: { id: addressId } })
    if (!address) throw new NotFoundException("Address not found")
    if (address.customerId !== customerId) throw new ForbiddenException()
    await this.prisma.customerAddress.delete({ where: { id: addressId } })
    return { success: true }
  }

  private serialize(c: any) {
    return {
      ...c,
      totalSpent: Number(c.totalSpent),
    }
  }
}
