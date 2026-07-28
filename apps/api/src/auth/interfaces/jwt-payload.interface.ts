export interface JwtPayload {
  sub: string
  email?: string
  role: string
  restaurantId?: string
  branchId?: string
}
