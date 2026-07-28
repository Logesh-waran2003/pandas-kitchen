import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets"
import { Server, Socket } from "socket.io"
import { JwtService } from "@nestjs/jwt"
import { Logger } from "@nestjs/common"

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  },
  namespace: "/",
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(EventsGateway.name)

  constructor(private jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace("Bearer ", "")

      if (!token) {
        client.disconnect()
        return
      }

      const payload = this.jwt.verify(token, {
        secret: process.env.JWT_SECRET,
      }) as any

      client.data.userId = payload.sub
      client.data.restaurantId = payload.restaurantId
      client.data.branchId = payload.branchId
      client.data.role = payload.role

      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`)
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`)
  }

  @SubscribeMessage("join:branch")
  handleJoinBranch(
    @MessageBody() branchId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`branch:${branchId}`)
    return { joined: `branch:${branchId}` }
  }

  @SubscribeMessage("join:kitchen")
  handleJoinKitchen(
    @MessageBody() branchId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`kitchen:${branchId}`)
    return { joined: `kitchen:${branchId}` }
  }

  // ── Emit helpers (called by services) ─────────────────────────────────────

  emitToKitchen(branchId: string, event: string, payload: any) {
    this.server.to(`kitchen:${branchId}`).emit(event, payload)
  }

  emitToBranch(branchId: string, event: string, payload: any) {
    this.server.to(`branch:${branchId}`).emit(event, payload)
  }
}
