import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler"
import { APP_GUARD } from "@nestjs/core"
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
import { ShiftsModule } from "./shifts/shifts.module"
import { AiModule } from "./ai/ai.module"
import { EmployeesModule } from "./employees/employees.module"
import { ReservationsModule } from "./reservations/reservations.module"
import { PushModule } from "./push/push.module"
import { CouponsModule } from "./coupons/coupons.module"

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
    ShiftsModule,
    AiModule,
    EmployeesModule,
    ReservationsModule,
    PushModule,
    CouponsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
