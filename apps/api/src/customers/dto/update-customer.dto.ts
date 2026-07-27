import { ApiPropertyOptional } from "@nestjs/swagger"

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: "Ravi Kumar" })
  name?: string

  @ApiPropertyOptional({ example: "9876543210" })
  phone?: string

  @ApiPropertyOptional({ example: "ravi@example.com" })
  email?: string

  @ApiPropertyOptional({ example: "123 Main St, Chennai" })
  address?: string

  @ApiPropertyOptional({ example: true })
  isActive?: boolean
}
