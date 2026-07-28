import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum } from "class-validator"

export class CreateDepartmentDto {
  @ApiProperty({ example: "clx..." })
  @IsString()
  @IsNotEmpty()
  branchId: string

  @ApiProperty({ example: "Grill Section" })
  @IsString()
  @IsNotEmpty()
  name: string
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: "Tandoor Section" })
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class CreateKOTDto {
  @ApiProperty({ example: "clx..." })
  @IsString()
  @IsNotEmpty()
  orderId: string
}

export class UpdateKOTStatusDto {
  @ApiProperty({ enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] })
  @IsEnum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
  status: string
}

export class UpdateKOTItemStatusDto {
  @ApiProperty({ enum: ["PENDING", "PREPARING", "DONE"] })
  @IsEnum(["PENDING", "PREPARING", "DONE"])
  status: string
}
