import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { PrismaModule } from "../prisma/prisma.module"
import { CustomersController } from "./customers.controller"
import { CustomersService } from "./customers.service"

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? "fallback-secret",
      signOptions: { expiresIn: "30d" },
    }),
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
