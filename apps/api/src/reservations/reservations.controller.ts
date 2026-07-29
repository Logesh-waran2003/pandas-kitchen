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
import { ReservationsService } from "./reservations.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CurrentUser } from "../auth/decorators/current-user.decorator"
import { CreateReservationDto, UpdateReservationDto } from "./dto/reservation.dto"

@ApiTags("reservations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reservations")
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Get()
  @ApiOperation({ summary: "List reservations (filter by branchId, date, status)" })
  @ApiQuery({ name: "branchId", required: false })
  @ApiQuery({ name: "date", required: false, description: "ISO date string, e.g. 2026-07-29" })
  @ApiQuery({ name: "status", required: false })
  listReservations(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("branchId") branchId?: string,
    @Query("date") date?: string,
    @Query("status") status?: string,
  ) {
    return this.reservationsService.listReservations(restaurantId, branchId, date, status)
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single reservation" })
  getReservation(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.reservationsService.getReservation(restaurantId, id)
  }

  @Post()
  @ApiOperation({ summary: "Create a reservation" })
  createReservation(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationsService.createReservation(restaurantId, dto)
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a reservation (status, table, notes, date)" })
  updateReservation(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationsService.updateReservation(restaurantId, id, dto)
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a reservation" })
  deleteReservation(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.reservationsService.deleteReservation(restaurantId, id)
  }
}
