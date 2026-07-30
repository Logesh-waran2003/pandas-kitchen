import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsEnum, IsOptional, IsInt, Min } from "class-validator"
import { OrderStatus } from "@prisma/client"

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus

  @ApiPropertyOptional({ description: "Estimated prep time in minutes (sent when accepting an order)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  eta?: number
}
