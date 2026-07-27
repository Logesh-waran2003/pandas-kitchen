import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from "@nestjs/common"
import { Prisma } from "@prisma/client"

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = "Database error"

    switch (exception.code) {
      case "P2002":
        status = HttpStatus.CONFLICT
        message = `Unique constraint violation on field: ${(exception.meta?.target as string[])?.join(", ")}`
        break
      case "P2025":
        status = HttpStatus.NOT_FOUND
        message = "Record not found"
        break
      case "P2003":
        status = HttpStatus.BAD_REQUEST
        message = "Foreign key constraint failed"
        break
    }

    response.status(status).send({
      statusCode: status,
      message,
      error: exception.code,
    })
  }
}
