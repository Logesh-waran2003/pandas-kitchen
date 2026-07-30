import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_MAILTO ?? 'mailto:admin@pandaskitchen.com',
  process.env.VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? '',
)

export interface SubscribeDto {
  endpoint: string
  p256dh: string
  auth: string
  orderId?: string
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name)

  constructor(private prisma: PrismaService) {}

  async subscribe(dto: SubscribeDto): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: { p256dh: dto.p256dh, auth: dto.auth, orderId: dto.orderId ?? null },
      create: {
        endpoint: dto.endpoint,
        p256dh: dto.p256dh,
        auth: dto.auth,
        orderId: dto.orderId ?? null,
      },
    })
  }

  async sendToOrder(orderId: string, title: string, body: string): Promise<void> {
    const subs = await this.prisma.pushSubscription.findMany({ where: { orderId } })
    const payload = JSON.stringify({ title, body })

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
        } catch (err: unknown) {
          // 410 Gone = subscription expired, clean it up
          if ((err as { statusCode?: number }).statusCode === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
          } else {
            this.logger.warn(`Push failed for sub ${sub.id}: ${err}`)
          }
        }
      }),
    )
  }
}
