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
import { UserRole } from "@prisma/client"
import { EmployeesService } from "./employees.service"
import { CreateEmployeeDto, UpdateEmployeeDto } from "./dto/employee.dto"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { Roles } from "../auth/decorators/roles.decorator"
import { CurrentUser } from "../auth/decorators/current-user.decorator"

@ApiTags("employees")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RESTAURANT_OWNER, UserRole.BRANCH_MANAGER)
@Controller("employees")
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: "List all staff for a restaurant / branch" })
  @ApiQuery({ name: "restaurantId", required: false })
  @ApiQuery({ name: "branchId", required: false })
  list(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("restaurantId") qRestaurantId?: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.employeesService.list(qRestaurantId ?? restaurantId, branchId)
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single employee" })
  findOne(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.employeesService.findOne(restaurantId, id)
  }

  @Post()
  @ApiOperation({ summary: "Create a staff user" })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto)
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update employee name, role, branchId, or isActive" })
  update(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(restaurantId, id, dto)
  }

  @Delete(":id")
  @ApiOperation({ summary: "Soft-delete (deactivate) an employee" })
  deactivate(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.employeesService.deactivate(restaurantId, id)
  }
}
