import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { CreateMenuCategoryDto } from "./dto/create-menu-category.dto"
import { UpdateMenuCategoryDto } from "./dto/update-menu-category.dto"
import { CreateMenuItemDto } from "./dto/create-menu-item.dto"
import { UpdateMenuItemDto } from "./dto/update-menu-item.dto"
import {
  CreateVariantDto,
  UpdateVariantDto,
  CreateAddonGroupDto,
  UpdateAddonGroupDto,
  CreateAddonDto,
  UpdateAddonDto,
  LinkAddonGroupDto,
} from "./dto/menu-variants-addons.dto"

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  // ── Categories ──────────────────────────────────────────────────────────────

  async listCategories(restaurantId: string) {
    const cats = await this.prisma.menuCategory.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { items: true } } },
    })
    return cats.map((c) => ({ ...c, itemCount: c._count.items }))
  }

  async createCategory(restaurantId: string, dto: CreateMenuCategoryDto) {
    return this.prisma.menuCategory.create({
      data: {
        restaurantId,
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        sortOrder: dto.sortOrder ?? 0,
      },
    })
  }

  async updateCategory(restaurantId: string, id: string, dto: UpdateMenuCategoryDto) {
    await this.assertCategoryOwner(restaurantId, id)
    return this.prisma.menuCategory.update({ where: { id }, data: dto })
  }

  async deleteCategory(restaurantId: string, id: string) {
    await this.assertCategoryOwner(restaurantId, id)

    const itemCount = await this.prisma.menuItem.count({ where: { categoryId: id } })
    if (itemCount > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${itemCount} item${itemCount === 1 ? '' : 's'}. Move or delete items first.`
      )
    }

    await this.prisma.menuCategory.delete({ where: { id } })
    return { success: true }
  }

  // ── Items ────────────────────────────────────────────────────────────────────

  async listItems(restaurantId: string, categoryId?: string) {
    const items = await this.prisma.menuItem.findMany({
      where: {
        restaurantId,
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })
    return items.map(this.serializeItem)
  }

  async createItem(restaurantId: string, dto: CreateMenuItemDto) {
    await this.assertCategoryOwner(restaurantId, dto.categoryId)
    const item = await this.prisma.menuItem.create({
      data: {
        restaurantId,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        imageUrl: dto.imageUrl,
        isVeg: dto.isVeg ?? false,
        allergens: dto.allergens ?? [],
        preparationTime: dto.preparationTime,
        sortOrder: dto.sortOrder ?? 0,
        departmentId: dto.departmentId ?? null,
      },
      include: { category: { select: { id: true, name: true } } },
    })
    return this.serializeItem(item)
  }

  async updateItem(restaurantId: string, id: string, dto: UpdateMenuItemDto) {
    await this.assertItemOwner(restaurantId, id)
    const item = await this.prisma.menuItem.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
        ...(dto.isVeg !== undefined && { isVeg: dto.isVeg }),
        ...(dto.allergens !== undefined && { allergens: dto.allergens }),
        ...(dto.preparationTime !== undefined && { preparationTime: dto.preparationTime }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
      },
      include: { category: { select: { id: true, name: true } } },
    })
    return this.serializeItem(item)
  }

  async deleteItem(restaurantId: string, id: string) {
    await this.assertItemOwner(restaurantId, id)
    await this.prisma.menuItem.delete({ where: { id } })
    return { success: true }
  }

  async toggleItemAvailability(restaurantId: string, id: string) {
    const item = await this.assertItemOwner(restaurantId, id)
    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: { isAvailable: !item.isAvailable },
      include: { category: { select: { id: true, name: true } } },
    })
    return this.serializeItem(updated)
  }

  // ── Variants ─────────────────────────────────────────────────────────────────

  async listVariants(restaurantId: string, menuItemId: string) {
    await this.assertItemOwner(restaurantId, menuItemId)
    const variants = await this.prisma.menuItemVariant.findMany({
      where: { menuItemId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })
    return variants.map(this.serializeVariant)
  }

  async createVariant(restaurantId: string, menuItemId: string, dto: CreateVariantDto) {
    await this.assertItemOwner(restaurantId, menuItemId)
    const variant = await this.prisma.menuItemVariant.create({
      data: {
        menuItemId,
        name: dto.name,
        price: dto.price,
        sortOrder: dto.sortOrder ?? 0,
      },
    })
    return this.serializeVariant(variant)
  }

  async updateVariant(restaurantId: string, variantId: string, dto: UpdateVariantDto) {
    await this.assertVariantOwner(restaurantId, variantId)
    const variant = await this.prisma.menuItemVariant.update({
      where: { id: variantId },
      data: dto,
    })
    return this.serializeVariant(variant)
  }

  async deleteVariant(restaurantId: string, variantId: string) {
    await this.assertVariantOwner(restaurantId, variantId)
    await this.prisma.menuItemVariant.delete({ where: { id: variantId } })
    return { success: true }
  }

  // ── Addon Groups ──────────────────────────────────────────────────────────────

  async listAddonGroups(restaurantId: string) {
    const groups = await this.prisma.menuAddonGroup.findMany({
      where: { restaurantId },
      include: { addons: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
      orderBy: { createdAt: "asc" },
    })
    return groups.map((g) => ({
      ...g,
      addons: g.addons.map(this.serializeAddon),
    }))
  }

  async createAddonGroup(restaurantId: string, dto: CreateAddonGroupDto) {
    return this.prisma.menuAddonGroup.create({
      data: {
        restaurantId,
        name: dto.name,
        minSelect: dto.minSelect ?? 0,
        maxSelect: dto.maxSelect ?? 1,
        isRequired: dto.isRequired ?? false,
      },
    })
  }

  async updateAddonGroup(restaurantId: string, id: string, dto: UpdateAddonGroupDto) {
    await this.assertAddonGroupOwner(restaurantId, id)
    return this.prisma.menuAddonGroup.update({ where: { id }, data: dto })
  }

  async deleteAddonGroup(restaurantId: string, id: string) {
    await this.assertAddonGroupOwner(restaurantId, id)
    await this.prisma.menuAddonGroup.delete({ where: { id } })
    return { success: true }
  }

  // ── Addons ────────────────────────────────────────────────────────────────────

  async listAddons(restaurantId: string, groupId: string) {
    await this.assertAddonGroupOwner(restaurantId, groupId)
    const addons = await this.prisma.menuAddon.findMany({
      where: { addonGroupId: groupId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })
    return addons.map(this.serializeAddon)
  }

  async createAddon(restaurantId: string, groupId: string, dto: CreateAddonDto) {
    await this.assertAddonGroupOwner(restaurantId, groupId)
    const addon = await this.prisma.menuAddon.create({
      data: {
        addonGroupId: groupId,
        name: dto.name,
        price: dto.price ?? 0,
        sortOrder: dto.sortOrder ?? 0,
      },
    })
    return this.serializeAddon(addon)
  }

  async updateAddon(restaurantId: string, addonId: string, dto: UpdateAddonDto) {
    await this.assertAddonOwner(restaurantId, addonId)
    const addon = await this.prisma.menuAddon.update({ where: { id: addonId }, data: dto })
    return this.serializeAddon(addon)
  }

  async deleteAddon(restaurantId: string, addonId: string) {
    await this.assertAddonOwner(restaurantId, addonId)
    await this.prisma.menuAddon.delete({ where: { id: addonId } })
    return { success: true }
  }

  // ── Item ↔ Addon Group Links ──────────────────────────────────────────────────

  async linkAddonGroup(restaurantId: string, menuItemId: string, dto: LinkAddonGroupDto) {
    await this.assertItemOwner(restaurantId, menuItemId)
    await this.assertAddonGroupOwner(restaurantId, dto.addonGroupId)

    await this.prisma.menuItemAddonGroup.upsert({
      where: { menuItemId_addonGroupId: { menuItemId, addonGroupId: dto.addonGroupId } },
      create: { menuItemId, addonGroupId: dto.addonGroupId },
      update: {},
    })
    return { success: true }
  }

  async unlinkAddonGroup(restaurantId: string, menuItemId: string, groupId: string) {
    await this.assertItemOwner(restaurantId, menuItemId)
    await this.prisma.menuItemAddonGroup.delete({
      where: { menuItemId_addonGroupId: { menuItemId, addonGroupId: groupId } },
    })
    return { success: true }
  }

  async listPublicMenu(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true },
    })
    if (!restaurant) throw new NotFoundException("Restaurant not found")

    const categories = await this.prisma.menuCategory.findMany({
      where: { restaurantId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })

    const items = await this.prisma.menuItem.findMany({
      where: { restaurantId, isAvailable: true },
      include: {
        variants: {
          where: { isAvailable: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        addonGroups: {
          include: {
            addonGroup: {
              include: {
                addons: {
                  where: { isAvailable: true },
                  orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                },
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })

    const itemsByCategory = new Map<string, typeof items>()
    for (const item of items) {
      const bucket = itemsByCategory.get(item.categoryId) ?? []
      bucket.push(item)
      itemsByCategory.set(item.categoryId, bucket)
    }

    return {
      restaurant,
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        items: (itemsByCategory.get(cat.id) ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: Number(item.price),
          imageUrl: item.imageUrl,
          isVeg: item.isVeg,
          isAvailable: item.isAvailable,
          variants: item.variants.map((v) => ({
            id: v.id,
            name: v.name,
            price: Number(v.price),
          })),
          addonGroups: item.addonGroups.map((link) => ({
            id: link.addonGroup.id,
            name: link.addonGroup.name,
            minSelect: link.addonGroup.minSelect,
            maxSelect: link.addonGroup.maxSelect,
            isRequired: link.addonGroup.isRequired,
            addons: link.addonGroup.addons.map((a) => ({
              id: a.id,
              name: a.name,
              price: Number(a.price),
            })),
          })),
        })),
      })),
    }
  }

  // ── Public (unauthenticated) ──────────────────────────────────────────────────

  async listPublicCategories(restaurantId: string) {
    return this.prisma.menuCategory.findMany({
      where: { restaurantId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, description: true, imageUrl: true, sortOrder: true },
    })
  }

  async listPublicItems(restaurantId: string, categoryId?: string) {
    const items = await this.prisma.menuItem.findMany({
      where: {
        restaurantId,
        isAvailable: true,
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })
    return items.map(this.serializeItem)
  }

  async listPublicVariants(menuItemId: string) {
    const variants = await this.prisma.menuItemVariant.findMany({
      where: { menuItemId, isAvailable: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })
    return variants.map(this.serializeVariant)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async assertCategoryOwner(restaurantId: string, id: string) {
    const cat = await this.prisma.menuCategory.findUnique({ where: { id } })
    if (!cat) throw new NotFoundException("Category not found")
    if (cat.restaurantId !== restaurantId) throw new ForbiddenException()
    return cat
  }

  private async assertItemOwner(restaurantId: string, id: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } })
    if (!item) throw new NotFoundException("Menu item not found")
    if (item.restaurantId !== restaurantId) throw new ForbiddenException()
    return item
  }

  private async assertVariantOwner(restaurantId: string, variantId: string) {
    const variant = await this.prisma.menuItemVariant.findUnique({
      where: { id: variantId },
      include: { menuItem: { select: { restaurantId: true } } },
    })
    if (!variant) throw new NotFoundException("Variant not found")
    if (variant.menuItem.restaurantId !== restaurantId) throw new ForbiddenException()
    return variant
  }

  private async assertAddonGroupOwner(restaurantId: string, id: string) {
    const group = await this.prisma.menuAddonGroup.findUnique({ where: { id } })
    if (!group) throw new NotFoundException("Addon group not found")
    if (group.restaurantId !== restaurantId) throw new ForbiddenException()
    return group
  }

  private async assertAddonOwner(restaurantId: string, addonId: string) {
    const addon = await this.prisma.menuAddon.findUnique({
      where: { id: addonId },
      include: { addonGroup: { select: { restaurantId: true } } },
    })
    if (!addon) throw new NotFoundException("Addon not found")
    if (addon.addonGroup.restaurantId !== restaurantId) throw new ForbiddenException()
    return addon
  }

  private serializeItem(item: any) {
    return { ...item, price: Number(item.price) }
  }

  private serializeVariant(v: any) {
    return { ...v, price: Number(v.price) }
  }

  private serializeAddon(a: any) {
    return { ...a, price: Number(a.price) }
  }
}
