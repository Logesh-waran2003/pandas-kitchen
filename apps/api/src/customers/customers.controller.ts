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
import { CreateCustomerDto } from "./dto/create-customer.dto"
import { UpdateCustomerDto } from "./dto/update-customer.dto"

@ApiTags("customers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("customers")
export class CustomersController {
  constructor(private customersService: CustomersService) {}

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
