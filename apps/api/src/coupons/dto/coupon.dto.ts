import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  IsDateString,
  MinLength,
} from "class-validator"

export enum DiscountTypeEnum {
  PERCENT = "PERCENT",
  FLAT = "FLAT",
}

export class CreateCouponDto {
  @ApiProperty({ example: "SAVE20" })
  @IsString()
  @MinLength(1)
  code: string

  @ApiProperty({ enum: DiscountTypeEnum })
  @IsEnum(DiscountTypeEnum)
  discountType: DiscountTypeEnum

  @ApiProperty({ example: 20 })
  @IsNumber()
  @Min(0)
  discountValue: number

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number

  @ApiPropertyOptional({ example: 100, description: "null = unlimited" })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number

  @ApiPropertyOptional({ example: "2026-12-31T23:59:59Z" })
  @IsOptional()
  @IsDateString()
  expiresAt?: string
}

export class UpdateCouponDto {
  @ApiPropertyOptional({ enum: DiscountTypeEnum })
  @IsOptional()
  @IsEnum(DiscountTypeEnum)
  discountType?: DiscountTypeEnum

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number

  @ApiPropertyOptional({ example: "2026-12-31T23:59:59Z" })
  @IsOptional()
  @IsDateString()
  expiresAt?: string

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
