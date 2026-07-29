import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from "class-validator"

export class OpenShiftDto {
  @ApiProperty({ example: "main-branch" })
  @IsString() @IsNotEmpty()
  branchId: string

  @ApiPropertyOptional({ example: 5000, description: "Opening cash float amount" })
  @IsOptional() @IsNumber() @Min(0)
  openingFloat?: number

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string
}

export class CloseShiftDto {
  @ApiPropertyOptional({ example: 4800, description: "Physical cash counted at close" })
  @IsOptional() @IsNumber() @Min(0)
  closingFloat?: number

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string
}
