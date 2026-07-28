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
import { InventoryService } from "./inventory.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CurrentUser } from "../auth/decorators/current-user.decorator"
import { CreateInventoryItemDto, UpdateInventoryItemDto, AdjustStockDto } from "./dto/inventory.dto"

@ApiTags("inventory")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("inventory")
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: "List inventory items for a branch" })
  @ApiQuery({ name: "branchId", required: true })
  listItems(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("branchId") branchId: string,
  ) {
    return this.inventoryService.listItems(restaurantId, branchId)
  }

  @Get("low-stock")
  @ApiOperation({ summary: "List items below minimum stock level" })
  @ApiQuery({ name: "branchId", required: true })
  getLowStock(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("branchId") branchId: string,
  ) {
    return this.inventoryService.getLowStockItems(restaurantId, branchId)
  }

  @Post()
  @ApiOperation({ summary: "Create inventory item" })
  createItem(
    @CurrentUser("restaurantId") restaurantId: string,
    @CurrentUser("sub") userId: string,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.inventoryService.createItem(restaurantId, userId, dto)
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update inventory item" })
  updateItem(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateItem(restaurantId, id, dto)
  }

  @Delete(":id")
  @ApiOperation({ summary: "Soft delete inventory item" })
  deleteItem(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.inventoryService.deleteItem(restaurantId, id)
  }

  @Post(":id/adjust")
  @ApiOperation({ summary: "Adjust stock (restock, deduction, waste)" })
  adjustStock(
    @CurrentUser("restaurantId") restaurantId: string,
    @CurrentUser("sub") userId: string,
    @Param("id") id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventoryService.adjustStock(restaurantId, id, userId, dto)
  }

  @Get(":id/history")
  @ApiOperation({ summary: "Get stock adjustment history for an item" })
  getHistory(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.inventoryService.getItemHistory(restaurantId, id)
  }
}
