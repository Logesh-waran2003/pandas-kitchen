import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsPositive, IsBoolean, IsInt, Min } from "class-validator"

export class CreateMenuItemDto {
  @ApiProperty({ example: "clx..." })
  @IsString()
  @IsNotEmpty()
  categoryId: string

  @ApiProperty({ example: "Paneer Tikka" })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiPropertyOptional({ example: "Marinated cottage cheese grilled to perfection" })
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty({ example: 220.00 })
  @IsNumber()
  @IsPositive()
  price: number

  @ApiPropertyOptional({ example: "https://cdn.example.com/paneer-tikka.jpg" })
  @IsOptional()
  @IsString()
  imageUrl?: string

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isVeg?: boolean

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  preparationTime?: number

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}
