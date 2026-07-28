import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { EventsModule } from "../events/events.module"
import { OrdersController } from "./orders.controller"
import { OrdersService } from "./orders.service"

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
