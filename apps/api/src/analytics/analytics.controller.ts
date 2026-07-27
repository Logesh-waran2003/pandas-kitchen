import { Controller, Get, Query, UseGuards } from "@nestjs/common"
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
}
