import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

export class CreateVariantDto {
  @ApiProperty({ example: "Large" })
  name: string

  @ApiProperty({ example: 299.00 })
  price: number

  @ApiPropertyOptional({ example: 0 })
  sortOrder?: number
}

export class UpdateVariantDto {
  @ApiPropertyOptional({ example: "Large" })
  name?: string

  @ApiPropertyOptional({ example: 299.00 })
  price?: number

  @ApiPropertyOptional({ example: true })
  isAvailable?: boolean

  @ApiPropertyOptional({ example: 0 })
  sortOrder?: number
}

export class CreateAddonGroupDto {
  @ApiProperty({ example: "Extra Toppings" })
  name: string

  @ApiPropertyOptional({ example: 0 })
  minSelect?: number

  @ApiPropertyOptional({ example: 3 })
  maxSelect?: number

  @ApiPropertyOptional({ example: false })
  isRequired?: boolean
}

export class UpdateAddonGroupDto {
  @ApiPropertyOptional({ example: "Extra Toppings" })
  name?: string

  @ApiPropertyOptional({ example: 0 })
  minSelect?: number

  @ApiPropertyOptional({ example: 3 })
  maxSelect?: number

  @ApiPropertyOptional({ example: false })
  isRequired?: boolean

  @ApiPropertyOptional({ example: true })
  isActive?: boolean
}

export class CreateAddonDto {
  @ApiProperty({ example: "Extra Cheese" })
  name: string

  @ApiPropertyOptional({ example: 30.00 })
  price?: number

  @ApiPropertyOptional({ example: 0 })
  sortOrder?: number
}

export class UpdateAddonDto {
  @ApiPropertyOptional({ example: "Extra Cheese" })
  name?: string

  @ApiPropertyOptional({ example: 30.00 })
  price?: number

  @ApiPropertyOptional({ example: true })
  isAvailable?: boolean

  @ApiPropertyOptional({ example: 0 })
  sortOrder?: number
}

export class LinkAddonGroupDto {
  @ApiProperty({ example: "clx..." })
  addonGroupId: string
}
