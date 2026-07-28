import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from "class-validator"

export class CreateMenuCategoryDto {
  @ApiProperty({ example: "Starters" })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiPropertyOptional({ example: "Light bites to begin your meal" })
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({ example: "https://cdn.example.com/starters.jpg" })
  @IsOptional()
  @IsString()
  imageUrl?: string

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}
