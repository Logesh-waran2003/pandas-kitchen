import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { UserRole } from "@prisma/client"
import { IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean, IsEnum, MinLength } from "class-validator"

export class CreateStaffDto {
  @ApiProperty({ example: "John Doe" })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: "john@pandaskitchen.com" })
  @IsEmail()
  email: string

  @ApiProperty({ example: "password123" })
  @IsString()
  @MinLength(6)
  password: string

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.CAPTAIN })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @ApiPropertyOptional({ example: "clx..." })
  @IsOptional()
  @IsString()
  branchId?: string
}

export class UpdateStaffDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
