import { ApiPropertyOptional } from "@nestjs/swagger"
import { TableStatus } from "@prisma/client"

export class UpdateTableDto {
  @ApiPropertyOptional()
  tableNumber?: string

  @ApiPropertyOptional()
  capacity?: number

  @ApiPropertyOptional({ enum: TableStatus })
  status?: TableStatus
}
