import { Controller, Post, Body, UseGuards } from "@nestjs/common"
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger"
import { AiService } from "./ai.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CurrentUser } from "../auth/decorators/current-user.decorator"
import { IsString, IsArray, ValidateNested, IsIn } from "class-validator"
import { Type } from "class-transformer"
import { ApiProperty } from "@nestjs/swagger"

class ChatMessageDto {
  @ApiProperty({ enum: ["user", "assistant"] })
  @IsIn(["user", "assistant"])
  role: string

  @ApiProperty()
  @IsString()
  content: string
}

class ChatDto {
  @ApiProperty()
  @IsString()
  restaurantId: string

  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[]
}

@ApiTags("ai")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("ai")
export class AiController {
  constructor(private aiService: AiService) {}

  @Post("chat")
  @ApiOperation({ summary: "AI chat for customer menu assistant" })
  chat(
    @CurrentUser("restaurantId") _restaurantId: string,
    @Body() dto: ChatDto,
  ) {
    // restaurantId from body so customer can chat for any restaurant they're browsing
    return this.aiService.chat(dto.restaurantId, dto.messages)
  }
}
