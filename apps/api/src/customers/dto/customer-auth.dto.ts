import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsNumber,
  Length,
  MinLength,
} from "class-validator"

export class CustomerRegisterDto {
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

  @ApiProperty({ example: "password123", minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string
}

export class CustomerLoginDto {
  @ApiProperty({ example: "9876543210" })
  @IsString()
  @IsNotEmpty()
  phone: string

  @ApiProperty({ example: "password123" })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class AddAddressDto {
  @ApiPropertyOptional({ example: "Home" })
  @IsOptional()
  @IsString()
  label?: string

  @ApiProperty({ example: "123 Main St, Chennai 600001" })
  @IsString()
  @IsNotEmpty()
  address: string

  @ApiPropertyOptional({ example: 13.0827 })
  @IsOptional()
  @IsNumber()
  lat?: number

  @ApiPropertyOptional({ example: 80.2707 })
  @IsOptional()
  @IsNumber()
  lng?: number

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean
}
