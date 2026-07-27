import { ApiPropertyOptional } from "@nestjs/swagger"

export class UpdateRestaurantDto {
  @ApiPropertyOptional({ example: "Pandas Kitchen" })
  name?: string

  @ApiPropertyOptional({ example: "https://cdn.example.com/logo.png" })
  logoUrl?: string

  @ApiPropertyOptional({ example: "#f97316" })
  themeColor?: string
}
