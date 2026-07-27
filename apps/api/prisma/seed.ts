import { PrismaClient, UserRole } from "@prisma/client"
import * as bcrypt from "bcryptjs"

const prisma = new PrismaClient()

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

  console.log("✅ Seed complete")
  console.log(`   Restaurant: ${restaurant.name} (${restaurant.slug})`)
  console.log(`   Branch: ${branch.name}`)
  console.log(`   User: ${user.email} (${user.role})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
