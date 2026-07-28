import { ApiPropertyOptional } from "@nestjs/swagger"
import { TableStatus } from "@prisma/client"
import { IsString, IsOptional, IsInt, Min, IsEnum, IsIn } from "class-validator"

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

  // Floor plan layout fields
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  posX?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  posY?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(20)
  width?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(20)
  height?: number

  @ApiPropertyOptional({ enum: ["rectangle", "circle"] })
  @IsOptional()
  @IsIn(["rectangle", "circle"])
  shape?: string
}
