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
  IsDateString,
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

  @ApiPropertyOptional({ example: "123 Main St, City" })
  @IsOptional()
  @IsString()
  deliveryAddress?: string

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  paxCount?: number

  @ApiPropertyOptional({ example: "2026-08-01T18:30:00.000Z", description: "Scheduled delivery/pickup time" })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string

  @ApiPropertyOptional({ example: 30, description: "Delivery fee in currency units" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number

  @ApiPropertyOptional({ example: 10, description: "Packaging fee in currency units" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  packagingFee?: number

  @ApiPropertyOptional({ example: 20, description: "Tip amount in currency units" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tip?: number

  @ApiPropertyOptional({ example: "SUMMER20", description: "Coupon code to apply" })
  @IsOptional()
  @IsString()
  couponCode?: string

  @ApiPropertyOptional({ example: 100, description: "Loyalty points to redeem" })
  @IsOptional()
  @IsInt()
  @Min(0)
  loyaltyPointsRedeem?: number

  @ApiPropertyOptional({ enum: ["POS", "QR_TABLE", "ONLINE"], default: "QR_TABLE" })
  @IsOptional()
  @IsEnum(["POS", "QR_TABLE", "ONLINE"])
  orderSource?: "POS" | "QR_TABLE" | "ONLINE"

  @ApiPropertyOptional({ example: "John Doe", description: "Customer name for takeaway/delivery" })
  @IsOptional()
  @IsString()
  customerName?: string

  @ApiPropertyOptional({ example: "9876543210", description: "Customer phone for takeaway/delivery" })
  @IsOptional()
  @IsString()
  customerPhone?: string

  @ApiPropertyOptional({ example: "john@example.com" })
  @IsOptional()
  @IsString()
  customerEmail?: string

  @ApiProperty({ type: [OrderItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[]
}
