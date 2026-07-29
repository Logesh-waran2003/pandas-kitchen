import { IsString, IsOptional, IsInt, IsDateString, Min } from "class-validator"
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger"

export class CreateReservationDto {
  @ApiProperty() @IsString() restaurantId: string
  @ApiProperty() @IsString() branchId: string
  @ApiPropertyOptional() @IsOptional() @IsString() tableId?: string
  @ApiProperty() @IsString() customerName: string
  @ApiProperty() @IsString() phone: string
  @ApiProperty() @IsInt() @Min(1) partySize: number
  @ApiProperty() @IsDateString() date: string
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string
}

export class UpdateReservationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string
  @ApiPropertyOptional() @IsOptional() @IsString() tableId?: string
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string
  @ApiPropertyOptional() @IsOptional() @IsDateString() date?: string
}
