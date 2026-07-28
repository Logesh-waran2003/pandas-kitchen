import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { PaymentMethod } from "@prisma/client"
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsPositive, IsEnum } from "class-validator"

export class CreatePaymentDto {
  @ApiProperty({ example: "clx..." })
  @IsString()
  @IsNotEmpty()
  orderId: string

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod

  @ApiProperty({ example: 450.00 })
  @IsNumber()
  @IsPositive()
  amount: number

  @ApiPropertyOptional({ example: "TXN123456" })
  @IsOptional()
  @IsString()
  reference?: string
}
