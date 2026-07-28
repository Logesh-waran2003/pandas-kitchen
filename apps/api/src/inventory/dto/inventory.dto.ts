import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsPositive, Min, IsEnum } from "class-validator"
import { StockAdjustmentType } from "@prisma/client"

export class CreateInventoryItemDto {
  @ApiProperty({ example: "main-branch" })
  @IsString() @IsNotEmpty()
  branchId: string

  @ApiProperty({ example: "Tomatoes" })
  @IsString() @IsNotEmpty()
  name: string

  @ApiProperty({ example: "kg" })
  @IsString() @IsNotEmpty()
  unit: string

  @ApiPropertyOptional({ example: 10.5 })
  @IsOptional() @IsNumber() @Min(0)
  currentStock?: number

  @ApiPropertyOptional({ example: 2.0, description: "Alert when stock falls below this" })
  @IsOptional() @IsNumber() @Min(0)
  minStock?: number

  @ApiPropertyOptional({ example: 45.00 })
  @IsOptional() @IsNumber() @Min(0)
  costPerUnit?: number
}

export class UpdateInventoryItemDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty()
  name?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  unit?: string

  @ApiPropertyOptional()
  @IsOptional() @IsNumber() @Min(0)
  minStock?: number

  @ApiPropertyOptional()
  @IsOptional() @IsNumber() @Min(0)
  costPerUnit?: number
}

export class AdjustStockDto {
  @ApiProperty({ enum: StockAdjustmentType })
  @IsEnum(StockAdjustmentType)
  type: StockAdjustmentType

  @ApiProperty({ example: 5.0, description: "Positive number — direction determined by type" })
  @IsNumber() @IsPositive()
  quantity: number

  @ApiPropertyOptional({ example: "Received from Sharma Farms" })
  @IsOptional() @IsString()
  note?: string
}
