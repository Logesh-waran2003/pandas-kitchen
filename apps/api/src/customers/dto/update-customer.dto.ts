import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsString, IsOptional, IsEmail, IsBoolean, Length } from "class-validator"

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: "Ravi Kumar" })
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional({ example: "9876543210" })
  @IsOptional()
  @IsString()
  @Length(7, 15)
  phone?: string

  @ApiPropertyOptional({ example: "ravi@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional({ example: "123 Main St, Chennai" })
  @IsOptional()
  @IsString()
  address?: string

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
