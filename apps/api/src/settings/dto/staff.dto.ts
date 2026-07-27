import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { UserRole } from "@prisma/client"

export class CreateStaffDto {
  @ApiProperty({ example: "John Doe" })
  name: string

  @ApiProperty({ example: "john@pandaskitchen.com" })
  email: string

  @ApiProperty({ example: "password123" })
  password: string

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.CAPTAIN })
  role?: UserRole

  @ApiPropertyOptional({ example: "clx..." })
  branchId?: string
}

export class UpdateStaffDto {
  @ApiPropertyOptional()
  name?: string

  @ApiPropertyOptional({ enum: UserRole })
  role?: UserRole

  @ApiPropertyOptional()
  isActive?: boolean
}
