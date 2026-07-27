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
import { KitchenService } from "./kitchen.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CurrentUser } from "../auth/decorators/current-user.decorator"
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateKOTDto,
  UpdateKOTStatusDto,
  UpdateKOTItemStatusDto,
} from "./dto/kitchen.dto"

@ApiTags("kitchen")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("kitchen")
export class KitchenController {
  constructor(private kitchenService: KitchenService) {}

  // ── Departments ──────────────────────────────────────────────────────────────

  @Get("departments")
  @ApiOperation({ summary: "List departments for a branch" })
  @ApiQuery({ name: "branchId", required: true })
  listDepartments(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("branchId") branchId: string,
  ) {
    return this.kitchenService.listDepartments(restaurantId, branchId)
  }

  @Post("departments")
  @ApiOperation({ summary: "Create a department" })
  createDepartment(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.kitchenService.createDepartment(restaurantId, dto)
  }

  @Patch("departments/:id")
  @ApiOperation({ summary: "Update a department" })
  updateDepartment(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.kitchenService.updateDepartment(restaurantId, id, dto)
  }

  @Delete("departments/:id")
  @ApiOperation({ summary: "Soft delete a department" })
  deleteDepartment(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.kitchenService.deleteDepartment(restaurantId, id)
  }

  // ── KOT Tickets ──────────────────────────────────────────────────────────────

  @Get("kot")
  @ApiOperation({ summary: "List KOT tickets for a branch" })
  @ApiQuery({ name: "branchId", required: true })
  @ApiQuery({ name: "status", required: false, enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] })
  listKOT(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("branchId") branchId: string,
    @Query("status") status?: string,
  ) {
    return this.kitchenService.listKOT(restaurantId, branchId, status)
  }

  @Get("kot/:id")
  @ApiOperation({ summary: "Get a KOT ticket with all items" })
  getKOT(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.kitchenService.getKOT(restaurantId, id)
  }

  @Post("kot")
  @ApiOperation({ summary: "Create a KOT ticket for an order" })
  createKOT(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body() dto: CreateKOTDto,
  ) {
    return this.kitchenService.createKOT(restaurantId, dto)
  }

  @Patch("kot/:id/status")
  @ApiOperation({ summary: "Update KOT ticket status" })
  updateKOTStatus(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateKOTStatusDto,
  ) {
    return this.kitchenService.updateKOTStatus(restaurantId, id, dto)
  }

  @Patch("kot/items/:itemId/status")
  @ApiOperation({ summary: "Update individual KOT item status" })
  updateKOTItemStatus(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateKOTItemStatusDto,
  ) {
    return this.kitchenService.updateKOTItemStatus(restaurantId, itemId, dto)
  }
}
