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
import { SettingsService } from "./settings.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CurrentUser } from "../auth/decorators/current-user.decorator"
import { Public } from "../auth/decorators/public.decorator"
import { UpdateRestaurantDto } from "./dto/update-restaurant.dto"
import { CreateBranchDto, UpdateBranchDto } from "./dto/branch.dto"
import { CreateStaffDto, UpdateStaffDto } from "./dto/staff.dto"
import { UpdateOnlineSettingsDto } from "./dto/online-settings.dto"

@ApiTags("settings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("settings")
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  // ── Restaurant ───────────────────────────────────────────────────────────────

  @Get("restaurant")
  @ApiOperation({ summary: "Get current restaurant profile" })
  getRestaurant(@CurrentUser("restaurantId") restaurantId: string) {
    return this.settingsService.getRestaurant(restaurantId)
  }

  @Patch("restaurant")
  @ApiOperation({ summary: "Update restaurant profile" })
  updateRestaurant(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.settingsService.updateRestaurant(restaurantId, dto)
  }

  // ── Branches ─────────────────────────────────────────────────────────────────

  @Get("branches")
  @ApiOperation({ summary: "List all branches" })
  listBranches(@CurrentUser("restaurantId") restaurantId: string) {
    return this.settingsService.listBranches(restaurantId)
  }

  @Post("branches")
  @ApiOperation({ summary: "Create a branch" })
  createBranch(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body() dto: CreateBranchDto,
  ) {
    return this.settingsService.createBranch(restaurantId, dto)
  }

  @Patch("branches/:id")
  @ApiOperation({ summary: "Update a branch" })
  updateBranch(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.settingsService.updateBranch(restaurantId, id, dto)
  }

  // ── Staff ────────────────────────────────────────────────────────────────────

  @Get("staff")
  @ApiOperation({ summary: "List all staff in the restaurant" })
  listStaff(@CurrentUser("restaurantId") restaurantId: string) {
    return this.settingsService.listStaff(restaurantId)
  }

  @Post("staff")
  @ApiOperation({ summary: "Create a staff member" })
  createStaff(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body() dto: CreateStaffDto,
  ) {
    return this.settingsService.createStaff(restaurantId, dto)
  }

  @Patch("staff/:id")
  @ApiOperation({ summary: "Update a staff member" })
  updateStaff(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.settingsService.updateStaff(restaurantId, id, dto)
  }

  @Delete("staff/:id")
  @ApiOperation({ summary: "Deactivate a staff member (soft delete)" })
  deleteStaff(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.settingsService.deleteStaff(restaurantId, id)
  }

  // ── Public restaurant info ───────────────────────────────────────────────────

  @Public()
  @Get("restaurant/:slug/public")
  @ApiOperation({ summary: "Public: get restaurant info by slug" })
  getPublicRestaurantInfo(@Param("slug") slug: string) {
    return this.settingsService.getPublicRestaurantInfo(slug)
  }

  // ── Online Settings ──────────────────────────────────────────────────────────

  @Public()
  @Get(":restaurantId/online-settings")
  @ApiOperation({ summary: "Public: get online ordering settings for a restaurant" })
  getOnlineSettings(@Param("restaurantId") restaurantId: string) {
    return this.settingsService.getOnlineSettings(restaurantId)
  }

  @Patch(":restaurantId/online-settings")
  @ApiOperation({ summary: "Admin: update online ordering settings" })
  updateOnlineSettings(
    @Param("restaurantId") restaurantId: string,
    @Body() dto: UpdateOnlineSettingsDto,
  ) {
    return this.settingsService.updateOnlineSettings(restaurantId, dto)
  }
}
