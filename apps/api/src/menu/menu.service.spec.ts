import { NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common"
import { MenuService } from "./menu.service"

function makePrisma() {
  return {
    menuCategory: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    menuItem: {
      count: jest.fn(),
    },
  }
}

const RESTAURANT_ID = "rest-1"
const CATEGORY_ID = "cat-1"

describe("MenuService", () => {
  let service: MenuService
  let prisma: ReturnType<typeof makePrisma>

  beforeEach(() => {
    prisma = makePrisma()
    service = new MenuService(prisma as any)
  })

  describe("deleteCategory", () => {
    it("category has items → throws BadRequestException mentioning item count", async () => {
      prisma.menuCategory.findUnique.mockResolvedValue({ id: CATEGORY_ID, restaurantId: RESTAURANT_ID })
      prisma.menuItem.count.mockResolvedValue(2)

      await expect(service.deleteCategory(RESTAURANT_ID, CATEGORY_ID)).rejects.toThrow(
        BadRequestException
      )

      await expect(service.deleteCategory(RESTAURANT_ID, CATEGORY_ID)).rejects.toThrow("2")
    })

    it("category has 0 items → calls menuCategory.delete, returns { success: true }", async () => {
      prisma.menuCategory.findUnique.mockResolvedValue({ id: CATEGORY_ID, restaurantId: RESTAURANT_ID })
      prisma.menuItem.count.mockResolvedValue(0)
      prisma.menuCategory.delete.mockResolvedValue({ id: CATEGORY_ID })

      const result = await service.deleteCategory(RESTAURANT_ID, CATEGORY_ID)

      expect(prisma.menuCategory.delete).toHaveBeenCalledWith({ where: { id: CATEGORY_ID } })
      expect(result).toEqual({ success: true })
    })

    it("category not found → throws NotFoundException", async () => {
      prisma.menuCategory.findUnique.mockResolvedValue(null)

      await expect(service.deleteCategory(RESTAURANT_ID, CATEGORY_ID)).rejects.toThrow(
        NotFoundException
      )
    })

    it("category belongs to different restaurant → throws ForbiddenException", async () => {
      prisma.menuCategory.findUnique.mockResolvedValue({
        id: CATEGORY_ID,
        restaurantId: "other-rest",
      })

      await expect(service.deleteCategory(RESTAURANT_ID, CATEGORY_ID)).rejects.toThrow(
        ForbiddenException
      )
    })
  })
})
