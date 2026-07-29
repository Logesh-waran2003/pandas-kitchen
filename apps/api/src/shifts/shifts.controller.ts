import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from "@nestjs/common"
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger"
import { ShiftsService } from "./shifts.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CurrentUser } from "../auth/decorators/current-user.decorator"
import { OpenShiftDto, CloseShiftDto } from "./dto/shifts.dto"

@ApiTags("shifts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("shifts")
export class ShiftsController {
  constructor(private shiftsService: ShiftsService) {}

  @Get("active")
  @ApiOperation({ summary: "Get active shift for a branch" })
  @ApiQuery({ name: "branchId", required: true })
  getActive(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("branchId") branchId: string,
  ) {
    return this.shiftsService.getActiveShift(restaurantId, branchId)
  }

  @Get()
  @ApiOperation({ summary: "List recent shifts for a branch" })
  @ApiQuery({ name: "branchId", required: true })
  list(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("branchId") branchId: string,
  ) {
    return this.shiftsService.listShifts(restaurantId, branchId)
  }

  @Post("open")
  @ApiOperation({ summary: "Open a new shift" })
  open(
    @CurrentUser("restaurantId") restaurantId: string,
    @CurrentUser("id") userId: string,
    @Body() dto: OpenShiftDto,
  ) {
    return this.shiftsService.openShift(restaurantId, userId, dto)
  }

  @Patch(":id/close")
  @ApiOperation({ summary: "Close a shift with cash reconciliation" })
  close(
    @CurrentUser("restaurantId") restaurantId: string,
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: CloseShiftDto,
  ) {
    return this.shiftsService.closeShift(restaurantId, userId, id, dto)
  }

  @Get(":id/summary")
  @ApiOperation({ summary: "Get shift summary with payment breakdown" })
  summary(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.shiftsService.getShiftSummary(restaurantId, id)
  }
}
