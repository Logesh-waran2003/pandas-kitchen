import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common"
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger"
import { MenuService } from "./menu.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CurrentUser } from "../auth/decorators/current-user.decorator"
import { Public } from "../auth/decorators/public.decorator"
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

@ApiTags("menu")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("menu")
export class MenuController {
  constructor(private menuService: MenuService) {}

  // ── Public (unauthenticated) ─────────────────────────────────────────────────

  @Public()
  @Get("public/:restaurantId")
  @ApiOperation({ summary: "Public: full menu for a restaurant (categories + items + variants + addons)" })
  getPublicMenu(@Param("restaurantId") restaurantId: string) {
    return this.menuService.listPublicMenu(restaurantId)
  }

  @Public()
  @Get("public/categories")
  @ApiOperation({ summary: "Public: list active categories for a restaurant" })
  @ApiQuery({ name: "restaurantId", required: true })
  listPublicCategories(@Query("restaurantId") restaurantId: string) {
    return this.menuService.listPublicCategories(restaurantId)
  }

  @Public()
  @Get("public/items")
  @ApiOperation({ summary: "Public: list available items for a restaurant" })
  @ApiQuery({ name: "restaurantId", required: true })
  @ApiQuery({ name: "categoryId", required: false })
  listPublicItems(
    @Query("restaurantId") restaurantId: string,
    @Query("categoryId") categoryId?: string,
  ) {
    return this.menuService.listPublicItems(restaurantId, categoryId)
  }

  @Public()
  @Get("public/items/:id/variants")
  @ApiOperation({ summary: "Public: list available variants for a menu item" })
  listPublicVariants(@Param("id") id: string) {
    return this.menuService.listPublicVariants(id)
  }

  // ── Categories ───────────────────────────────────────────────────────────────

  @Get("categories")
  @ApiOperation({ summary: "List all menu categories for the restaurant" })
  listCategories(@CurrentUser("restaurantId") restaurantId: string) {
    return this.menuService.listCategories(restaurantId)
  }

  @Post("categories")
  @ApiOperation({ summary: "Create a menu category" })
  createCategory(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body() dto: CreateMenuCategoryDto,
  ) {
    return this.menuService.createCategory(restaurantId, dto)
  }

  @Patch("categories/:id")
  @ApiOperation({ summary: "Update a menu category" })
  updateCategory(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    return this.menuService.updateCategory(restaurantId, id, dto)
  }

  @Delete("categories/:id")
  @ApiOperation({ summary: "Delete a menu category" })
  deleteCategory(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.menuService.deleteCategory(restaurantId, id)
  }

  // ── Items ────────────────────────────────────────────────────────────────────

  @Get("items")
  @ApiOperation({ summary: "List all menu items, optionally filtered by category" })
  @ApiQuery({ name: "categoryId", required: false })
  listItems(
    @CurrentUser("restaurantId") restaurantId: string,
    @Query("categoryId") categoryId?: string,
  ) {
    return this.menuService.listItems(restaurantId, categoryId)
  }

  @Post("items")
  @ApiOperation({ summary: "Create a menu item" })
  createItem(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.menuService.createItem(restaurantId, dto)
  }

  @Patch("items/:id")
  @ApiOperation({ summary: "Update a menu item" })
  updateItem(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuService.updateItem(restaurantId, id, dto)
  }

  @Delete("items/:id")
  @ApiOperation({ summary: "Delete a menu item" })
  deleteItem(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.menuService.deleteItem(restaurantId, id)
  }

  @Patch("items/:id/toggle")
  @ApiOperation({ summary: "Toggle item availability" })
  toggleItem(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.menuService.toggleItemAvailability(restaurantId, id)
  }

  // ── Variants ──────────────────────────────────────────────────────────────────

  @Get("items/:id/variants")
  @ApiOperation({ summary: "List variants for a menu item" })
  listVariants(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.menuService.listVariants(restaurantId, id)
  }

  @Post("items/:id/variants")
  @ApiOperation({ summary: "Create a variant for a menu item" })
  createVariant(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.menuService.createVariant(restaurantId, id, dto)
  }

  @Patch("variants/:variantId")
  @ApiOperation({ summary: "Update a menu item variant" })
  updateVariant(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("variantId") variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.menuService.updateVariant(restaurantId, variantId, dto)
  }

  @Delete("variants/:variantId")
  @ApiOperation({ summary: "Delete a menu item variant" })
  deleteVariant(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("variantId") variantId: string,
  ) {
    return this.menuService.deleteVariant(restaurantId, variantId)
  }

  // ── Addon Groups ──────────────────────────────────────────────────────────────

  @Get("addon-groups")
  @ApiOperation({ summary: "List addon groups for the restaurant" })
  listAddonGroups(@CurrentUser("restaurantId") restaurantId: string) {
    return this.menuService.listAddonGroups(restaurantId)
  }

  @Post("addon-groups")
  @ApiOperation({ summary: "Create an addon group" })
  createAddonGroup(
    @CurrentUser("restaurantId") restaurantId: string,
    @Body() dto: CreateAddonGroupDto,
  ) {
    return this.menuService.createAddonGroup(restaurantId, dto)
  }

  @Patch("addon-groups/:id")
  @ApiOperation({ summary: "Update an addon group" })
  updateAddonGroup(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateAddonGroupDto,
  ) {
    return this.menuService.updateAddonGroup(restaurantId, id, dto)
  }

  @Delete("addon-groups/:id")
  @ApiOperation({ summary: "Delete an addon group" })
  deleteAddonGroup(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
  ) {
    return this.menuService.deleteAddonGroup(restaurantId, id)
  }

  // ── Addons ────────────────────────────────────────────────────────────────────

  @Get("addon-groups/:groupId/addons")
  @ApiOperation({ summary: "List addons in a group" })
  listAddons(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("groupId") groupId: string,
  ) {
    return this.menuService.listAddons(restaurantId, groupId)
  }

  @Post("addon-groups/:groupId/addons")
  @ApiOperation({ summary: "Create an addon in a group" })
  createAddon(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("groupId") groupId: string,
    @Body() dto: CreateAddonDto,
  ) {
    return this.menuService.createAddon(restaurantId, groupId, dto)
  }

  @Patch("addons/:addonId")
  @ApiOperation({ summary: "Update an addon" })
  updateAddon(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("addonId") addonId: string,
    @Body() dto: UpdateAddonDto,
  ) {
    return this.menuService.updateAddon(restaurantId, addonId, dto)
  }

  @Delete("addons/:addonId")
  @ApiOperation({ summary: "Delete an addon" })
  deleteAddon(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("addonId") addonId: string,
  ) {
    return this.menuService.deleteAddon(restaurantId, addonId)
  }

  // ── Item ↔ Addon Group Links ──────────────────────────────────────────────────

  @Post("items/:id/addon-groups")
  @ApiOperation({ summary: "Link an addon group to a menu item" })
  linkAddonGroup(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Body() dto: LinkAddonGroupDto,
  ) {
    return this.menuService.linkAddonGroup(restaurantId, id, dto)
  }

  @Delete("items/:id/addon-groups/:groupId")
  @ApiOperation({ summary: "Unlink an addon group from a menu item" })
  unlinkAddonGroup(
    @CurrentUser("restaurantId") restaurantId: string,
    @Param("id") id: string,
    @Param("groupId") groupId: string,
  ) {
    return this.menuService.unlinkAddonGroup(restaurantId, id, groupId)
  }
}
