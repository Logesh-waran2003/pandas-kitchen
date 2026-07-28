import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { ThrottlerModule } from "@nestjs/throttler"
import { PrismaModule } from "./prisma/prisma.module"
import { AuthModule } from "./auth/auth.module"
import { MenuModule } from "./menu/menu.module"
import { TablesModule } from "./tables/tables.module"
import { OrdersModule } from "./orders/orders.module"
import { AnalyticsModule } from "./analytics/analytics.module"
import { SettingsModule } from "./settings/settings.module"
import { CustomersModule } from "./customers/customers.module"
import { KitchenModule } from "./kitchen/kitchen.module"
import { PaymentsModule } from "./payments/payments.module"
import { EventsModule } from "./events/events.module"
import { InventoryModule } from "./inventory/inventory.module"

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    MenuModule,
    TablesModule,
    OrdersModule,
    AnalyticsModule,
    SettingsModule,
    CustomersModule,
    KitchenModule,
    PaymentsModule,
    EventsModule,
    InventoryModule,
  ],
})
export class AppModule {}
