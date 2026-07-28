import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { OrderType } from "@prisma/client"
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from "class-validator"
import { Type } from "class-transformer"

export class OrderItemInputDto {
  @ApiProperty({ example: "clx..." })
  @IsString()
  @IsNotEmpty()
  menuItemId: string

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number

  @ApiPropertyOptional({ example: "clx..." })
  @IsOptional()
  @IsString()
  variantId?: string

  @ApiPropertyOptional({ type: [String], example: ["clx...", "clx..."] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  addonIds?: string[]

  @ApiPropertyOptional({ example: "No onions please" })
  @IsOptional()
  @IsString()
  notes?: string
}

export class CreateOrderDto {
  @ApiProperty({ example: "clx..." })
  @IsString()
  @IsNotEmpty()
  branchId: string

  @ApiPropertyOptional({ example: "clx..." })
  @IsOptional()
  @IsString()
  tableId?: string

  @ApiPropertyOptional({ example: "clx..." })
  @IsOptional()
  @IsString()
  customerId?: string

  @ApiPropertyOptional({ enum: OrderType, default: OrderType.DINE_IN })
  @IsOptional()
  @IsEnum(OrderType)
  orderType?: OrderType

  @ApiPropertyOptional({ example: 10, description: "Discount amount or percentage" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number

  @ApiPropertyOptional({ enum: ["PERCENT", "FLAT"], default: "FLAT" })
  @IsOptional()
  @IsEnum(["PERCENT", "FLAT"])
  discountType?: "PERCENT" | "FLAT"

  @ApiPropertyOptional({ example: 5, description: "Service charge percentage" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceChargePercent?: number

  @ApiPropertyOptional({ example: 5, description: "GST rate percentage" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gstRate?: number

  @ApiPropertyOptional({ example: "Extra napkins" })
  @IsOptional()
  @IsString()
  notes?: string

  @ApiProperty({ type: [OrderItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[]
}
