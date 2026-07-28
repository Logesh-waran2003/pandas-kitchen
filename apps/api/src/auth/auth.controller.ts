import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common"
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger"
import { AuthService } from "./auth.service"
import { JwtAuthGuard } from "./guards/jwt-auth.guard"
import { Public } from "./decorators/public.decorator"
import { CurrentUser } from "./decorators/current-user.decorator"
import { LoginDto } from "./dto/login.dto"
import { RefreshTokenDto } from "./dto/refresh-token.dto"

@ApiTags("auth")
@Controller("auth")
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post("login")
  @ApiOperation({ summary: "Login with email + password" })
  login(@Body() body: LoginDto) {
    return this.authService.login(body)
  }

  @Public()
  @Post("customer/login")
  @ApiOperation({ summary: "Customer login — create or find by phone" })
  customerLogin(@Body() body: unknown) {
    return this.authService.customerLogin(body)
  }

  @Public()
  @Post("refresh")
  @ApiOperation({ summary: "Refresh access token" })
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken)
  }

  @Post("logout")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout and invalidate session" })
  logout(@CurrentUser("id") userId: string, @Request() req: any) {
    const token = req.headers?.authorization?.replace("Bearer ", "") ?? ""
    return this.authService.logout(userId, token)
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user" })
  me(@CurrentUser("id") userId: string) {
    return this.authService.me(userId)
  }
}
