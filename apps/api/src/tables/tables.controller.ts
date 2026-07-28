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
import { TablesService } from "./tables.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CurrentUser } from "../auth/decorators/current-user.decorator"
import { Public } from "../auth/decorators/public.decorator"
import { CreateTableDto } from "./dto/create-table.dto"
import { UpdateTableDto } from "./dto/update-table.dto"
import { UpdateTableStatusDto } from "./dto/update-table-status.dto"

@ApiTags("tables")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("tables")
export class TablesController {
  constructor(private tablesService: TablesService) {}

  @Public()
  @Get(":id/public")
  @ApiOperation({ summary: "Public table info for QR landing" })
  getPublicTable(@Param("id") id: string) {
    return this.tablesService.getPublicTable(id)
  }

  @Get()
  @ApiOperation({ summary: "List all tables for a branch" })
  @ApiQuery({ name: "branchId", required: true })
  listTables(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("branchId") branchId: string,
  ) {
    return this.tablesService.listTables(restaurantId, branchId)
  }

  @Post()
  @ApiOperation({ summary: "Create a table" })
  createTable(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body() dto: CreateTableDto,
  ) {
    return this.tablesService.createTable(restaurantId, dto)
  }

  @Patch("transfer")
  @ApiOperation({ summary: "Transfer an active order to a different table" })
  transferTable(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body("orderId") orderId: string,
    @Body("newTableId") newTableId: string,
  ) {
    return this.tablesService.transferTable(orderId, newTableId, restaurantId)
  }

  @Post("merge")
  @ApiOperation({ summary: "Merge two tables — move secondary order items into primary, cancel secondary" })
  mergeTables(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body("primaryOrderId") primaryOrderId: string,
    @Body("secondaryOrderId") secondaryOrderId: string,
  ) {
    return this.tablesService.mergeTables(primaryOrderId, secondaryOrderId, restaurantId)
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a table" })
  updateTable(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tablesService.updateTable(restaurantId, id, dto)
  }

  @Delete(":id")
  @ApiOperation({ summary: "Deactivate (soft-delete) a table" })
  deleteTable(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.tablesService.deleteTable(restaurantId, id)
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update table status only" })
  updateStatus(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return this.tablesService.updateStatus(restaurantId, id, dto)
  }
}
