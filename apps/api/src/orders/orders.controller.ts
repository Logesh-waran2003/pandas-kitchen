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
import { OrdersService } from "./orders.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CurrentUser } from "../auth/decorators/current-user.decorator"
import { Public } from "../auth/decorators/public.decorator"
import { CreateOrderDto } from "./dto/create-order.dto"
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto"

@ApiTags("orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Public()
  @Post("public")
  @ApiOperation({ summary: "Public: place an order from QR table (no auth required)" })
  createPublicOrder(@Body() dto: CreateOrderDto) {
    // restaurantId is derived from branchId inside createOrder — pass empty string;
    // service fetches branch to validate, but also needs restaurantId match.
    // Use a dedicated service method that resolves restaurantId from branchId.
    return this.ordersService.createPublicOrder(dto)
  }

  @Get()
  @ApiOperation({ summary: "List orders with optional filters" })
  @ApiQuery({ name: "branchId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "date", required: false, description: "YYYY-MM-DD" })
  listOrders(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("branchId") branchId?: string,
    @Query("status") status?: string,
    @Query("date") date?: string,
  ) {
    return this.ordersService.listOrders(restaurantId, branchId, status, date)
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single order with items" })
  getOrder(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.ordersService.getOrder(restaurantId, id)
  }

  @Post()
  @ApiOperation({ summary: "Create an order with line items" })
  createOrder(
    @CurrentUser("restaurantId") restaurantId: string,
    @CurrentUser("sub") userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(restaurantId, userId, dto)
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update order status" })
  updateStatus(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(restaurantId, id, dto)
  }

  @Delete(":id")
  @ApiOperation({ summary: "Cancel an order" })
  cancelOrder(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.ordersService.cancelOrder(restaurantId, id)
  }
}
