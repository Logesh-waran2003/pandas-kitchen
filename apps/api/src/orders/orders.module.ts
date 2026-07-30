import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { EventsModule } from "../events/events.module"
import { InventoryModule } from "../inventory/inventory.module"
import { KitchenModule } from "../kitchen/kitchen.module"
import { SmsModule } from "../sms/sms.module"
import { PushModule } from "../push/push.module"
import { OrdersController } from "./orders.controller"
import { OrdersService } from "./orders.service"

@Module({
  imports: [PrismaModule, EventsModule, InventoryModule, KitchenModule, SmsModule, PushModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
