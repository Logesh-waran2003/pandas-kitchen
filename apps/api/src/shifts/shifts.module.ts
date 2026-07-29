import { Module } from "@nestjs/common"
import { ShiftsController } from "./shifts.controller"
import { ShiftsService } from "./shifts.service"
import { PrismaModule } from "../prisma/prisma.module"
import { EventsModule } from "../events/events.module"

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
})
export class ShiftsModule {}
