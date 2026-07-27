import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { TableStatus } from "@prisma/client"

export class CreateTableDto {
  @ApiProperty({ example: "clx..." })
  branchId: string

  @ApiProperty({ example: "T-01" })
  tableNumber: string

  @ApiPropertyOptional({ example: 4 })
  capacity?: number

  @ApiPropertyOptional({ enum: TableStatus, example: TableStatus.AVAILABLE })
  status?: TableStatus
}
