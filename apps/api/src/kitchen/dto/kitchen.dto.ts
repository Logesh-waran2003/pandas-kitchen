import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

export class CreateDepartmentDto {
  @ApiProperty({ example: "clx..." })
  branchId: string

  @ApiProperty({ example: "Grill Section" })
  name: string
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: "Tandoor Section" })
  name?: string

  @ApiPropertyOptional({ example: false })
  isActive?: boolean
}

export class CreateKOTDto {
  @ApiProperty({ example: "clx..." })
  orderId: string
}

export class UpdateKOTStatusDto {
  @ApiProperty({ enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] })
  status: string
}

export class UpdateKOTItemStatusDto {
  @ApiProperty({ enum: ["PENDING", "PREPARING", "DONE"] })
  status: string
}
