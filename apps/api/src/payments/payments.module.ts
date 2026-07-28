import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { EventsModule } from "../events/events.module"
import { PaymentsController } from "./payments.controller"
import { PaymentsService } from "./payments.service"

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
