import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { TableStatus } from "@prisma/client"
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsEnum } from "class-validator"

export class CreateTableDto {
  @ApiProperty({ example: "clx..." })
  @IsString()
  @IsNotEmpty()
  branchId: string

  @ApiProperty({ example: "T-01" })
  @IsString()
  @IsNotEmpty()
  tableNumber: string

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number

  @ApiPropertyOptional({ enum: TableStatus, example: TableStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(TableStatus)
  status?: TableStatus
}
