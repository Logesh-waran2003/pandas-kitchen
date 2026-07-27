import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

export class CreateMenuItemDto {
  @ApiProperty({ example: "clx..." })
  categoryId: string

  @ApiProperty({ example: "Paneer Tikka" })
  name: string

  @ApiPropertyOptional({ example: "Marinated cottage cheese grilled to perfection" })
  description?: string

  @ApiProperty({ example: 220.00 })
  price: number

  @ApiPropertyOptional({ example: "https://cdn.example.com/paneer-tikka.jpg" })
  imageUrl?: string

  @ApiPropertyOptional({ example: true })
  isVeg?: boolean

  @ApiPropertyOptional({ example: 15 })
  preparationTime?: number

  @ApiPropertyOptional({ example: 0 })
  sortOrder?: number
}
