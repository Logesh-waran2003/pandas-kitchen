import { ApiProperty } from "@nestjs/swagger"
import { OrderStatus } from "@prisma/client"

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus
}
