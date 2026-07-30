import { NestFactory } from "@nestjs/core"
import { ValidationPipe } from "@nestjs/common"
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger"
import * as express from "express"
import { AppModule } from "./app.module"
import { HttpExceptionFilter } from "./common/filters/http-exception.filter"
import { PrismaExceptionFilter } from "./common/filters/prisma-exception.filter"

async function bootstrap() {
  // Disable built-in body parser so we can enforce a size limit
  const app = await NestFactory.create(AppModule, { bodyParser: false })

  // Limit request bodies to 1 MB to prevent DOS via large payloads (SEC-03)
  app.use(express.json({ limit: "1mb" }))
  app.use(express.urlencoded({ extended: true, limit: "1mb" }))

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // Health check before global prefix so it's reachable at /health (not /api/v1/health)
  app.use('/health', (req: any, res: any) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

  app.setGlobalPrefix("api/v1")
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter())

  const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",").map(o => o.trim())
  app.enableCors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })

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
  const host = process.env.HOST ?? "0.0.0.0"
  await app.listen(port, host)
  console.log(`🐼 Pandas Kitchen API running on http://${host}:${port}/api/v1`)
  console.log(`📚 Swagger docs at http://${host}:${port}/docs`)
}

bootstrap()
