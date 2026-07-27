import { NestFactory } from "@nestjs/core"
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger"
import { AppModule } from "./app.module"
import { HttpExceptionFilter } from "./common/filters/http-exception.filter"
import { PrismaExceptionFilter } from "./common/filters/prisma-exception.filter"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix("api/v1")
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter())

  app.enableCors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "PATCH"] })

  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("Pandas Kitchen API")
      .setDescription("Restaurant management system API")
      .setVersion("1.0")
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup("docs", app, document)
  }

  const port = process.env.PORT ?? 3001
  await app.listen(port)
  console.log(`🐼 Pandas Kitchen API running on http://localhost:${port}/api/v1`)
  console.log(`📚 Swagger docs at http://localhost:${port}/docs`)
}

bootstrap()
