import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common"
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger"
import { CustomersService } from "./customers.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CurrentUser } from "../auth/decorators/current-user.decorator"
import { Public } from "../auth/decorators/public.decorator"
import { CreateCustomerDto } from "./dto/create-customer.dto"
import { UpdateCustomerDto } from "./dto/update-customer.dto"
import { CustomerRegisterDto, CustomerLoginDto, AddAddressDto } from "./dto/customer-auth.dto"

@ApiTags("customers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("customers")
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  // ── Customer self-service auth ────────────────────────────────────────────────

  @Public()
  @Post(":restaurantId/register")
  @ApiOperation({ summary: "Customer: register with password" })
  registerCustomer(
    @Param("restaurantId") restaurantId: string,
    @Body() dto: CustomerRegisterDto,
  ) {
    return this.customersService.registerCustomer(restaurantId, dto)
  }

  @Public()
  @Post(":restaurantId/login")
  @ApiOperation({ summary: "Customer: login with phone + password" })
  loginCustomer(
    @Param("restaurantId") restaurantId: string,
    @Body() dto: CustomerLoginDto,
  ) {
    return this.customersService.loginCustomer(restaurantId, dto)
  }

  // ── Customer address management ───────────────────────────────────────────────

  @Get("me/loyalty-balance/:restaurantId")
  @ApiOperation({ summary: "Customer: get current loyalty points balance" })
  getLoyaltyBalance(
    @CurrentUser("sub") customerId: string,
    @Param("restaurantId") restaurantId: string,
  ) {
    return this.customersService.getLoyaltyBalance(customerId, restaurantId)
  }

  @Get("me/addresses")
  @ApiOperation({ summary: "Customer: list own addresses" })
  getAddresses(@CurrentUser("sub") customerId: string) {
    return this.customersService.getAddresses(customerId)
  }

  @Post("me/addresses")
  @ApiOperation({ summary: "Customer: add a new address" })
  addAddress(
    @CurrentUser("sub") customerId: string,
    @Body() dto: AddAddressDto,
  ) {
    return this.customersService.addAddress(customerId, dto)
  }

  @Delete("me/addresses/:id")
  @ApiOperation({ summary: "Customer: delete an address" })
  deleteAddress(
    @CurrentUser("sub") customerId: string,
    @Param("id") id: string,
  ) {
    return this.customersService.deleteAddress(customerId, id)
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: "List customers for the restaurant" })
  @ApiQuery({ name: "search", required: false, description: "Search by name or phone" })
  listCustomers(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("search") search?: string,
  ) {
    return this.customersService.listCustomers(restaurantId, search)
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single customer" })
  getCustomer(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.customersService.getCustomer(restaurantId, id)
  }

  @Get(":id/orders")
  @ApiOperation({ summary: "Get order history for a customer" })
  getCustomerOrders(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.customersService.getCustomerOrders(restaurantId, id)
  }

  @Post()
  @ApiOperation({ summary: "Create a new customer" })
  createCustomer(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.createCustomer(restaurantId, dto)
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a customer" })
  updateCustomer(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateCustomer(restaurantId, id, dto)
  }

  @Delete(":id")
  @ApiOperation({ summary: "Soft delete a customer" })
  deleteCustomer(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.customersService.deleteCustomer(restaurantId, id)
  }
}
