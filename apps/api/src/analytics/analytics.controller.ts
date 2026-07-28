import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common"
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger"
import { AnalyticsService } from "./analytics.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CurrentUser } from "../auth/decorators/current-user.decorator"

@ApiTags("analytics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Revenue, orders, tables, and customers counts" })
  getSummary(@CurrentUser("restaurantId") restaurantId: string) {
    return this.analyticsService.getSummary(restaurantId)
  }

  @Get("revenue")
  @ApiOperation({ summary: "Daily revenue for the last 30 days" })
  getDailyRevenue(@CurrentUser("restaurantId") restaurantId: string) {
    return this.analyticsService.getDailyRevenue(restaurantId)
  }

  @Get("popular-items")
  @ApiOperation({ summary: "Top 10 menu items by quantity ordered" })
  getPopularItems(@CurrentUser("restaurantId") restaurantId: string) {
    return this.analyticsService.getPopularItems(restaurantId)
  }

  @Get("orders-by-status")
  @ApiOperation({ summary: "Order count grouped by status" })
  getOrdersByStatus(@CurrentUser("restaurantId") restaurantId: string) {
    return this.analyticsService.getOrdersByStatus(restaurantId)
  }

  @Get("daily-pnl")
  @ApiOperation({ summary: "Daily P&L — revenue, tax, discount, net, payment breakdown" })
  @ApiQuery({ name: "branchId", required: false })
  @ApiQuery({ name: "date", required: false, description: "YYYY-MM-DD, defaults to today" })
  getDailyPnL(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("branchId") branchId?: string,
    @Query("date") date?: string,
  ) {
    return this.analyticsService.getDailyPnL(restaurantId, branchId, date)
  }

  @Get("reports/:type")
  @ApiOperation({ summary: "Run a specific report: today-sales | daywise | item-wise | payment-modes | cancelled | customer-data" })
  @ApiQuery({ name: "restaurantId", required: false })
  @ApiQuery({ name: "from", required: false, description: "YYYY-MM-DD start date" })
  @ApiQuery({ name: "to", required: false, description: "YYYY-MM-DD end date" })
  @ApiQuery({ name: "branchId", required: false })
  getReport(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("type") type: string,
    @Query("restaurantId") qRestaurantId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("branchId") branchId?: string,
  ) {
    const today = new Date().toISOString().slice(0, 10)
    return this.analyticsService.getReport(
      qRestaurantId ?? restaurantId,
      type,
      from ?? today,
      to ?? today,
      branchId,
    )
  }
}
