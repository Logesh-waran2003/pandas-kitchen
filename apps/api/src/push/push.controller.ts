import { Controller, Post, Get, Body } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Public } from '../auth/decorators/public.decorator'
import { PushService, SubscribeDto } from './push.service'
import { IsString, IsOptional } from 'class-validator'

class SubscribePushDto {
  @IsString() endpoint: string
  @IsString() p256dh: string
  @IsString() auth: string
  @IsOptional() @IsString() orderId?: string
}

@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private pushService: PushService) {}

  @Public()
  @Post('subscribe')
  @ApiOperation({ summary: 'Save a Web Push subscription' })
  subscribe(@Body() dto: SubscribePushDto) {
    return this.pushService.subscribe(dto)
  }

  @Public()
  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Get VAPID public key for push subscription' })
  getPublicKey() {
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? '' }
  }
}
