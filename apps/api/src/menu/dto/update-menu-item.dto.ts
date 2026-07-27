import { ApiPropertyOptional } from "@nestjs/swagger"

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
}
