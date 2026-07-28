import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsString, IsOptional } from "class-validator"

export class UpdateRestaurantDto {
  @ApiPropertyOptional({ example: "Pandas Kitchen" })
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional({ example: "https://cdn.example.com/logo.png" })
  @IsOptional()
  @IsString()
  logoUrl?: string

  @ApiPropertyOptional({ example: "#f97316" })
  @IsOptional()
  @IsString()
  themeColor?: string
}
