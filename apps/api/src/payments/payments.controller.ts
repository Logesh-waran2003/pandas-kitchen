import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common"
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger"
import { PaymentsService } from "./payments.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CurrentUser } from "../auth/decorators/current-user.decorator"
import { CreatePaymentDto } from "./dto/create-payment.dto"

@ApiTags("payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("payments")
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: "List payments for an order" })
  @ApiQuery({ name: "orderId", required: true })
  listPayments(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("orderId") orderId: string,
  ) {
    return this.paymentsService.listPayments(restaurantId, orderId)
  }

  @Post()
  @ApiOperation({ summary: "Record a payment for an order" })
  createPayment(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(restaurantId, dto)
  }

  @Post(":id/refund")
  @ApiOperation({ summary: "Refund a payment" })
  refundPayment(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.paymentsService.refundPayment(restaurantId, id)
  }
}
