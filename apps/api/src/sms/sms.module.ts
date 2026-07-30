import { Module } from '@nestjs/common'
import { SmsService } from './sms.service'
import { NoopSmsProvider } from './providers/noop.provider'
import { Fast2SmsProvider } from './providers/fast2sms.provider'

const provider = process.env.SMS_PROVIDER === 'fast2sms'
  ? Fast2SmsProvider
  : NoopSmsProvider

@Module({
  providers: [
    { provide: 'SmsProvider', useClass: provider },
    {
      provide: SmsService,
      useFactory: (p: NoopSmsProvider) => new SmsService(p),
      inject: ['SmsProvider'],
    },
  ],
  exports: [SmsService],
})
export class SmsModule {}
