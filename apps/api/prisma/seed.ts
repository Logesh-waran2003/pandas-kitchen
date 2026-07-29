import { PrismaClient, UserRole } from "@prisma/client"
import * as bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function upsertCategory(restaurantId: string, name: string) {
  const existing = await prisma.menuCategory.findFirst({ where: { restaurantId, name } })
  if (existing) return existing
  return prisma.menuCategory.create({ data: { restaurantId, name } })
}

async function upsertItem(
  restaurantId: string,
  categoryId: string,
  name: string,
  price: number,
  isVeg: boolean,
  preparationTime: number,
) {
  const existing = await prisma.menuItem.findFirst({ where: { categoryId, name } })
  if (existing) return existing
  return prisma.menuItem.create({
    data: { restaurantId, categoryId, name, price, isVeg, preparationTime },
  })
}

async function main() {
  console.log("🌱 Seeding database...")

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "pandas-kitchen" },
    update: {},
    create: {
      slug: "pandas-kitchen",
      name: "Pandas Kitchen",
      themeColor: "#f97316",
    },
  })

  const branch = await prisma.branch.upsert({
    where: { id: "main-branch" },
    update: {},
    create: {
      id: "main-branch",
      name: "Main Branch",
      restaurantId: restaurant.id,
    },
  })

  const passwordHash = await bcrypt.hash("admin123", 10)

  const user = await prisma.user.upsert({
    where: { email: "admin@pandaskitchen.com" },
    update: {},
    create: {
      email: "admin@pandaskitchen.com",
      passwordHash,
      name: "Admin",
      role: UserRole.RESTAURANT_OWNER,
      restaurantId: restaurant.id,
      branchId: branch.id,
    },
  })

  // ── Menu categories & items ──────────────────────────────────────────────

  const starters = await upsertCategory(restaurant.id, "Starters")
  await upsertItem(restaurant.id, starters.id, "Veg Spring Rolls", 120, true, 10)
  await upsertItem(restaurant.id, starters.id, "Chicken Wings", 220, false, 15)
  await upsertItem(restaurant.id, starters.id, "Paneer Tikka", 180, true, 12)
  await upsertItem(restaurant.id, starters.id, "Fish Fingers", 200, false, 15)

  const mainCourse = await upsertCategory(restaurant.id, "Main Course")
  await upsertItem(restaurant.id, mainCourse.id, "Dal Makhani", 180, true, 20)
  await upsertItem(restaurant.id, mainCourse.id, "Butter Chicken", 280, false, 20)
  await upsertItem(restaurant.id, mainCourse.id, "Paneer Butter Masala", 220, true, 18)
  await upsertItem(restaurant.id, mainCourse.id, "Chicken Biryani", 320, false, 25)
  await upsertItem(restaurant.id, mainCourse.id, "Veg Fried Rice", 160, true, 15)
  await upsertItem(restaurant.id, mainCourse.id, "Egg Fried Rice", 180, false, 15)

  const burgersWraps = await upsertCategory(restaurant.id, "Burgers & Wraps")
  await upsertItem(restaurant.id, burgersWraps.id, "Veg Burger", 150, true, 10)
  await upsertItem(restaurant.id, burgersWraps.id, "Chicken Burger", 180, false, 12)
  await upsertItem(restaurant.id, burgersWraps.id, "Paneer Wrap", 160, true, 10)
  await upsertItem(restaurant.id, burgersWraps.id, "Chicken Wrap", 190, false, 12)

  const beverages = await upsertCategory(restaurant.id, "Beverages")
  await upsertItem(restaurant.id, beverages.id, "Fresh Lime Soda", 60, true, 5)
  await upsertItem(restaurant.id, beverages.id, "Mango Lassi", 80, true, 5)
  await upsertItem(restaurant.id, beverages.id, "Cold Coffee", 100, true, 5)
  await upsertItem(restaurant.id, beverages.id, "Masala Chai", 40, true, 5)

  const desserts = await upsertCategory(restaurant.id, "Desserts")
  await upsertItem(restaurant.id, desserts.id, "Gulab Jamun", 80, true, 5)
  await upsertItem(restaurant.id, desserts.id, "Ice Cream (2 scoops)", 100, true, 5)
  await upsertItem(restaurant.id, desserts.id, "Chocolate Brownie", 120, true, 8)

  // ── Online settings ──────────────────────────────────────────────────────

  await prisma.restaurantOnlineSettings.upsert({
    where: { restaurantId: restaurant.id },
    update: {},
    create: {
      restaurantId: restaurant.id,
      onlineOrderingEnabled: true,
      deliveryEnabled: true,
      takeawayEnabled: true,
      deliveryFee: 40,
      packagingFee: 10,
      serviceChargePercent: 5,
      estimatedPrepMins: 20,
      pickupPrepMins: 15,
      minOrderValue: 100,
    },
  })

  // ── Test coupon ──────────────────────────────────────────────────────────

  await prisma.coupon.upsert({
    where: { restaurantId_code: { restaurantId: restaurant.id, code: "WELCOME20" } },
    update: {},
    create: {
      restaurantId: restaurant.id,
      code: "WELCOME20",
      discountType: "PERCENT",
      discountValue: 20,
      minOrderValue: 100,
      maxUses: 100,
      isActive: true,
    },
  })

  console.log("✅ Seed complete")
  console.log(`   Restaurant: ${restaurant.name} (${restaurant.slug}) id=${restaurant.id}`)
  console.log(`   Branch: ${branch.name}`)
  console.log(`   User: ${user.email} (${user.role})`)
  console.log(`   Menu: 5 categories, 21 items`)
  console.log(`   Coupon: WELCOME20 (20% off, min ₹100)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
