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
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",").map(o => o.trim()),
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

      // Allow unauthenticated connections — they can still join:order rooms
      // for guest order tracking. Staff/customer features require auth.
      if (!token) {
        client.data.role = "GUEST"
        this.logger.log(`Guest client connected: ${client.id}`)
        return
      }

      const payload = this.jwt.verify(token, {
        secret: process.env.JWT_SECRET,
      }) as any

      client.data.userId = payload.sub
      client.data.restaurantId = payload.restaurantId
      client.data.branchId = payload.branchId
      client.data.role = payload.role

      // Customers auto-join their restaurant room; staff join via explicit messages
      if (payload.role === "CUSTOMER") {
        client.join(`restaurant:${payload.restaurantId}`)
      }

      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub}, role: ${payload.role})`)
    } catch {
      // Invalid token — allow as guest so order tracking still works
      client.data.role = "GUEST"
      this.logger.warn(`Client connected with invalid token, treating as guest: ${client.id}`)
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

  @SubscribeMessage("join:order")
  handleJoinOrder(
    @MessageBody() orderId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`order:${orderId}`)
    return { joined: `order:${orderId}` }
  }

  @SubscribeMessage("table:call-waiter")
  handleCallWaiter(
    @MessageBody() payload: { tableId: string; tableNumber: string; branchId: string },
    @ConnectedSocket() _client: Socket,
  ) {
    this.server.to(`branch:${payload.branchId}`).emit("waiter:called", {
      tableId: payload.tableId,
      tableNumber: payload.tableNumber,
    })
  }

  @SubscribeMessage("table:request-bill")
  handleRequestBill(
    @MessageBody() payload: { tableId: string; tableNumber: string; branchId: string },
    @ConnectedSocket() _client: Socket,
  ) {
    this.server.to(`branch:${payload.branchId}`).emit("bill:requested", {
      tableId: payload.tableId,
      tableNumber: payload.tableNumber,
    })
  }

  // ── Emit helpers (called by services) ─────────────────────────────────────

  emitToKitchen(branchId: string, event: string, payload: any) {
    this.server.to(`kitchen:${branchId}`).emit(event, payload)
  }

  emitToBranch(branchId: string, event: string, payload: any) {
    this.server.to(`branch:${branchId}`).emit(event, payload)
  }

  emitToOrder(orderId: string, event: string, payload: any) {
    this.server.to(`order:${orderId}`).emit(event, payload)
  }

  emitToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data)
  }
}
