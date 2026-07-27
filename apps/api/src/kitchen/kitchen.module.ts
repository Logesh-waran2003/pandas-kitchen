import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { KitchenController } from "./kitchen.controller"
import { KitchenService } from "./kitchen.service"

@Module({
  imports: [PrismaModule],
  controllers: [KitchenController],
  providers: [KitchenService],
})
export class KitchenModule {}
