import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { OrderType } from "@prisma/client"

export class OrderItemInputDto {
  @ApiProperty({ example: "clx..." })
  menuItemId: string

  @ApiProperty({ example: 2 })
  quantity: number

  @ApiPropertyOptional({ example: "clx..." })
  variantId?: string

  @ApiPropertyOptional({ type: [String], example: ["clx...", "clx..."] })
  addonIds?: string[]

  @ApiPropertyOptional({ example: "No onions please" })
  notes?: string
}

export class CreateOrderDto {
  @ApiProperty({ example: "clx..." })
  branchId: string

  @ApiPropertyOptional({ example: "clx..." })
  tableId?: string

  @ApiPropertyOptional({ example: "clx..." })
  customerId?: string

  @ApiPropertyOptional({ enum: OrderType, default: OrderType.DINE_IN })
  orderType?: OrderType

  @ApiPropertyOptional({ example: 10, description: "Discount amount or percentage" })
  discount?: number

  @ApiPropertyOptional({ enum: ["PERCENT", "FLAT"], default: "FLAT" })
  discountType?: "PERCENT" | "FLAT"

  @ApiPropertyOptional({ example: 5, description: "Service charge percentage" })
  serviceChargePercent?: number

  @ApiPropertyOptional({ example: 5, description: "GST rate percentage" })
  gstRate?: number

  @ApiPropertyOptional({ example: "Extra napkins" })
  notes?: string

  @ApiProperty({ type: [OrderItemInputDto] })
  items: OrderItemInputDto[]
}
