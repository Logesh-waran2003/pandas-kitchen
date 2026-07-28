import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from "class-validator"

export class CreateBranchDto {
  @ApiProperty({ example: "Main Branch" })
  @IsString()
  @IsNotEmpty()
  name: string
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: "Downtown Branch" })
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
