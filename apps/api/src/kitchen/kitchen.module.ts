import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { EventsModule } from "../events/events.module"
import { KitchenController } from "./kitchen.controller"
import { KitchenService } from "./kitchen.service"

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [KitchenController],
  providers: [KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}
