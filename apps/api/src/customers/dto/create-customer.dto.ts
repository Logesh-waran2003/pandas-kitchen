import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

export class CreateCustomerDto {
  @ApiProperty({ example: "Ravi Kumar" })
  name: string

  @ApiProperty({ example: "9876543210" })
  phone: string

  @ApiPropertyOptional({ example: "ravi@example.com" })
  email?: string

  @ApiPropertyOptional({ example: "123 Main St, Chennai" })
  address?: string
}
