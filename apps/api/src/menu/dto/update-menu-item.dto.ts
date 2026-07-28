import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsOptional, IsArray, IsString, IsBoolean } from "class-validator"

export class UpdateMenuItemDto {
  @ApiPropertyOptional()
  categoryId?: string

  @ApiPropertyOptional()
  name?: string

  @ApiPropertyOptional()
  description?: string

  @ApiPropertyOptional()
  price?: number

  @ApiPropertyOptional()
  imageUrl?: string

  @ApiPropertyOptional()
  isAvailable?: boolean

  @ApiPropertyOptional()
  isVeg?: boolean

  @ApiPropertyOptional()
  preparationTime?: number

  @ApiPropertyOptional()
  sortOrder?: number

  @ApiPropertyOptional()
  departmentId?: string

  @ApiPropertyOptional({ example: ['gluten', 'dairy'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[]
}
