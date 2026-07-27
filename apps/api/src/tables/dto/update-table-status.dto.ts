import { ApiProperty } from "@nestjs/swagger"
import { TableStatus } from "@prisma/client"

export class UpdateTableStatusDto {
  @ApiProperty({ enum: TableStatus })
  status: TableStatus
}
