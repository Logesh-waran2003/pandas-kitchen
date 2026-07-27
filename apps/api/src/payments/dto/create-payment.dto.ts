import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { PaymentMethod } from "@prisma/client"

export class CreatePaymentDto {
  @ApiProperty({ example: "clx..." })
  orderId: string

  @ApiProperty({ enum: PaymentMethod })
  method: PaymentMethod

  @ApiProperty({ example: 450.00 })
  amount: number

  @ApiPropertyOptional({ example: "TXN123456" })
  reference?: string
}
