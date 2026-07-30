import { Injectable, Logger } from '@nestjs/common'
import { SmsProvider } from './interface'

@Injectable()
export class NoopSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS')

  async send(to: string, message: string): Promise<void> {
    this.logger.log(`[SMS NOOP] To: ${to} | ${message}`)
  }
}
