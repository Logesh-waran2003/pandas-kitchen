import { Injectable, Logger } from '@nestjs/common'
import { SmsProvider } from './interface'

/**
 * Fast2SMS provider — plug in when ready.
 * Set SMS_PROVIDER=fast2sms and FAST2SMS_API_KEY=<your-key> in .env
 * API docs: https://docs.fast2sms.com
 */
@Injectable()
export class Fast2SmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS')
  private readonly apiKey = process.env.FAST2SMS_API_KEY ?? ''

  async send(to: string, message: string): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn('FAST2SMS_API_KEY not set — SMS not sent')
      return
    }
    try {
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'q',          // transactional route (DLT registered)
          message,
          language: 'english',
          flash: 0,
          numbers: to,
        }),
      })
      const data = await res.json() as { return: boolean; message: string[] }
      if (!data.return) {
        this.logger.error(`Fast2SMS error: ${data.message?.join(', ')}`)
      }
    } catch (err) {
      this.logger.error(`Fast2SMS send failed: ${err}`)
    }
  }
}
