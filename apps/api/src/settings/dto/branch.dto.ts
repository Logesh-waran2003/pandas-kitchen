import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

export class CreateBranchDto {
  @ApiProperty({ example: "Main Branch" })
  name: string
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: "Downtown Branch" })
  name?: string

  @ApiPropertyOptional()
  isActive?: boolean
}
