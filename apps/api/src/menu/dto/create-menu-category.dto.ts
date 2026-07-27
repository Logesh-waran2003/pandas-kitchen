import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

export class CreateMenuCategoryDto {
  @ApiProperty({ example: "Starters" })
  name: string

  @ApiPropertyOptional({ example: "Light bites to begin your meal" })
  description?: string

  @ApiPropertyOptional({ example: "https://cdn.example.com/starters.jpg" })
  imageUrl?: string

  @ApiPropertyOptional({ example: 0 })
  sortOrder?: number
}
