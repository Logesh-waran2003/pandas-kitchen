import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { MenuController } from "./menu.controller"
import { MenuService } from "./menu.service"
import { UploadController } from "./upload.controller"

@Module({
  imports: [PrismaModule],
  controllers: [MenuController, UploadController],
  providers: [MenuService],
})
export class MenuModule {}
