import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { UserRole } from "@prisma/client"
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator"

export class CreateEmployeeDto {
  @ApiProperty({ example: "Jane Doe" })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: "jane@pandaskitchen.com" })
  @IsEmail()
  email: string

  @ApiProperty({ example: "secret123", minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string

  @ApiProperty({ enum: UserRole, example: UserRole.CAPTAIN })
  @IsEnum(UserRole)
  role: UserRole

  @ApiProperty({ example: "clx..." })
  @IsString()
  @IsNotEmpty()
  restaurantId: string

  @ApiPropertyOptional({ example: "clx..." })
  @IsOptional()
  @IsString()
  branchId?: string
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: "Jane Doe" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @ApiPropertyOptional({ example: "clx..." })
  @IsOptional()
  @IsString()
  branchId?: string

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  isActive?: boolean
}
