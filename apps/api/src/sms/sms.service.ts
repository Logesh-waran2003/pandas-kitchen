import { Injectable, Logger } from '@nestjs/common'
import { SmsProvider } from './providers/interface'
import { SmsTemplates } from './templates'

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)

  constructor(private readonly provider: SmsProvider) {}

  private normalizePhone(phone: string): string {
    // Strip leading +91 or 0, keep 10 digits
    return phone.replace(/^\+91|^0/, '').replace(/\D/g, '').slice(-10)
  }

  async sendOrderPlaced(phone: string | null | undefined, orderNum: string, restaurantName: string): Promise<void> {
    if (!phone) return
    try {
      await this.provider.send(this.normalizePhone(phone), SmsTemplates.orderPlaced(orderNum, restaurantName))
    } catch (err) {
      this.logger.error(`sendOrderPlaced failed: ${err}`)
    }
  }

  async sendOrderAccepted(phone: string | null | undefined, orderNum: string, etaMins: number, pickupCode?: string): Promise<void> {
    if (!phone) return
    try {
      await this.provider.send(this.normalizePhone(phone), SmsTemplates.orderAccepted(orderNum, etaMins, pickupCode))
    } catch (err) {
      this.logger.error(`sendOrderAccepted failed: ${err}`)
    }
  }

  async sendOrderReady(phone: string | null | undefined, orderNum: string, pickupCode?: string): Promise<void> {
    if (!phone) return
    try {
      await this.provider.send(this.normalizePhone(phone), SmsTemplates.orderReady(orderNum, pickupCode))
    } catch (err) {
      this.logger.error(`sendOrderReady failed: ${err}`)
    }
  }

  async sendOrderCancelled(phone: string | null | undefined, orderNum: string): Promise<void> {
    if (!phone) return
    try {
      await this.provider.send(this.normalizePhone(phone), SmsTemplates.orderCancelled(orderNum))
    } catch (err) {
      this.logger.error(`sendOrderCancelled failed: ${err}`)
    }
  }
}
