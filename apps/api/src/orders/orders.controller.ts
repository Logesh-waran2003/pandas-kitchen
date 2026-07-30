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
import { EditOrderDto } from "./dto/edit-order.dto"

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
    return this.ordersService.createPublicOrder(dto)
  }

  @Public()
  @Get("coupon/:restaurantId/:code")
  @ApiOperation({ summary: "Public: validate a coupon code" })
  @ApiQuery({ name: "subtotal", required: false, description: "Order subtotal for min-value check" })
  validateCoupon(
    @Param("restaurantId") restaurantId: string,
    @Param("code") code: string,
    @Query("subtotal") subtotal?: string,
  ) {
    return this.ordersService.validateCoupon(restaurantId, code, subtotal ? Number(subtotal) : 0)
  }

  @Public()
  @Patch(":id/rating")
  @ApiOperation({ summary: "Customer: submit star rating for a served order" })
  submitRating(
    @Param("id") id: string,
    @Body("rating") rating: number,
    @Body("customerId") customerId: string,
  ) {
    return this.ordersService.submitRating(id, rating, customerId)
  }

  @Public()
  @Patch(":id/cancel")
  @ApiOperation({ summary: "Customer: cancel own PENDING order within 2 minutes" })
  cancelPublicOrder(
    @Param("id") id: string,
    @Body("customerId") customerId: string,
  ) {
    return this.ordersService.cancelPublicOrder(id, customerId)
  }

  @Public()
  @Post(":id/cancel")
  @ApiOperation({ summary: "Customer self-cancel a PENDING order (within 3 min window)" })
  customerCancelOrder(
    @Param("id") id: string,
    @Body() body: { reason?: string },
  ) {
    return this.ordersService.customerCancelOrder(id, body.reason)
  }

  @Get("stats/today")
  @ApiOperation({ summary: "Get today order stats for dashboard" })
  getTodayStats(@CurrentUser("restaurantId") restaurantId: string) {
    return this.ordersService.getTodayStats(restaurantId)
  }

  @Get()
  @ApiOperation({ summary: "List orders with optional filters" })
  @ApiQuery({ name: "branchId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "date", required: false, description: "YYYY-MM-DD" })
  @ApiQuery({ name: "page", required: false, description: "Page number (default: 1)" })
  @ApiQuery({ name: "limit", required: false, description: "Items per page (default: 20, max: 100)" })
  @ApiQuery({ name: "orderType", required: false, enum: ["DINE_IN", "TAKEAWAY", "DELIVERY"] })
  @ApiQuery({ name: "orderSource", required: false, enum: ["POS", "QR_TABLE", "ONLINE"] })
  listOrders(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("branchId") branchId?: string,
    @Query("status") status?: string,
    @Query("date") date?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("orderType") orderType?: string,
    @Query("orderSource") orderSource?: string,
  ) {
    return this.ordersService.listOrders(
      restaurantId,
      branchId,
      status,
      date,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      orderType,
      orderSource,
    )
  }

  @Public()
  @Get("by-customer/:customerId")
  @ApiOperation({ summary: "Public: get order history for a customer" })
  @ApiQuery({ name: "limit", required: false, description: "Max orders to return (default: 20, max: 50)" })
  getCustomerOrders(
    @Param("customerId") customerId: string,
    @Query("limit") limit?: string,
  ) {
    return this.ordersService.getCustomerOrders(customerId, limit ? parseInt(limit) : 20)
  }

  @Get(":id/receipt")
  @ApiOperation({ summary: "Get receipt data for an order" })
  getReceipt(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.ordersService.getReceipt(id, restaurantId)
  }

  @Public()
  @Get(":id/track")
  @ApiOperation({ summary: "Track a single order — public, no auth required" })
  trackOrder(
    @CurrentUser("sub") customerId: string | undefined,
    @Param("id") id: string,
  ) {
    return this.ordersService.findOneForTracking(id, customerId)
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

  @Patch(":id/edit")
  @ApiOperation({ summary: "Edit items on a PENDING/CONFIRMED order" })
  editOrder(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: EditOrderDto,
  ) {
    return this.ordersService.editOrder(restaurantId, id, dto)
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
