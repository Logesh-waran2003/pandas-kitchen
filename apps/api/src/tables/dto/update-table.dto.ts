import { ApiPropertyOptional } from "@nestjs/swagger"
import { TableStatus } from "@prisma/client"
import { IsString, IsOptional, IsInt, Min, IsEnum } from "class-validator"

export class UpdateTableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tableNumber?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number

  @ApiPropertyOptional({ enum: TableStatus })
  @IsOptional()
  @IsEnum(TableStatus)
  status?: TableStatus
}
