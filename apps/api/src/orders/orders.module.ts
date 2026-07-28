import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { EventsModule } from "../events/events.module"
import { InventoryModule } from "../inventory/inventory.module"
import { KitchenModule } from "../kitchen/kitchen.module"
import { OrdersController } from "./orders.controller"
import { OrdersService } from "./orders.service"

@Module({
  imports: [PrismaModule, EventsModule, InventoryModule, KitchenModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
