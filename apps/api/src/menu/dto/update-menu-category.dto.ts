import { ApiPropertyOptional } from "@nestjs/swagger"

export class UpdateMenuCategoryDto {
  @ApiPropertyOptional()
  name?: string

  @ApiPropertyOptional()
  description?: string

  @ApiPropertyOptional()
  imageUrl?: string

  @ApiPropertyOptional()
  isActive?: boolean

  @ApiPropertyOptional()
  sortOrder?: number
}
