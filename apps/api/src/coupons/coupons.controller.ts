import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common"
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger"
import { CouponsService } from "./coupons.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CurrentUser } from "../auth/decorators/current-user.decorator"
import { CreateCouponDto, UpdateCouponDto } from "./dto/coupon.dto"

@ApiTags("coupons")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("coupons")
export class CouponsController {
  constructor(private couponsService: CouponsService) {}

  @Get()
  @ApiOperation({ summary: "List all coupons for the restaurant" })
  listCoupons(@CurrentUser("restaurantId") restaurantId: string) {
    return this.couponsService.listCoupons(restaurantId)
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single coupon" })
  getCoupon(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.couponsService.getCoupon(restaurantId, id)
  }

  @Post()
  @ApiOperation({ summary: "Create a new coupon" })
  createCoupon(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body() dto: CreateCouponDto,
  ) {
    return this.couponsService.createCoupon(restaurantId, dto)
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a coupon (toggle active, change value, etc.)" })
  updateCoupon(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.couponsService.updateCoupon(restaurantId, id, dto)
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a coupon (only if never used)" })
  deleteCoupon(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.couponsService.deleteCoupon(restaurantId, id)
  }
}
