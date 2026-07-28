import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsString, IsNotEmpty, IsOptional, IsEmail, Length } from "class-validator"

export class CreateCustomerDto {
  @ApiProperty({ example: "Ravi Kumar" })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: "9876543210" })
  @IsString()
  @IsNotEmpty()
  @Length(7, 15)
  phone: string

  @ApiPropertyOptional({ example: "ravi@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional({ example: "123 Main St, Chennai" })
  @IsOptional()
  @IsString()
  address?: string
}
