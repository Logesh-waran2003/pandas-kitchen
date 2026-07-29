import { IsArray, ValidateNested, IsString, IsInt, Min, IsOptional } from 'class-validator'
import { Type } from 'class-transformer'

export class EditOrderItemDto {
  @IsString() menuItemId: string
  @IsInt() @Min(1) quantity: number
  @IsOptional() @IsString() notes?: string
}

export class EditOrderDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => EditOrderItemDto)
  items: EditOrderItemDto[]
}
