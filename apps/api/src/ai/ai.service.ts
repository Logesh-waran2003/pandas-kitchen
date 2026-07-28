import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { ConfigService } from "@nestjs/config"

interface ChatMessage {
  role: string
  content: string
}

@Injectable()
export class AiService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async chat(restaurantId: string, messages: ChatMessage[]) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    })
    const restaurantName = restaurant?.name ?? "our restaurant"

    const menuItems = await this.prisma.menuItem.findMany({
      where: { restaurantId, isAvailable: true },
      select: { name: true, price: true, description: true, isVeg: true },
      take: 50,
      orderBy: { name: "asc" },
    })

    const menuText = menuItems
      .map((i) => `- ${i.name} (₹${Number(i.price).toFixed(0)})${i.isVeg ? " [veg]" : ""}${i.description ? `: ${i.description}` : ""}`)
      .join("\n")

    const systemPrompt = `You are the friendly AI dining assistant for ${restaurantName}.

Current menu:
${menuText}

Rules:
- Only discuss items on the menu above
- Keep responses under 3 sentences unless listing items
- When recommending an item, format it as: **Item Name** (₹price)
- Be warm, helpful, and concise`

    const apiKey = this.config.get<string>("OPENAI_API_KEY")
    if (!apiKey) {
      // Mock response using top 3 items
      const topThree = menuItems.slice(0, 3).map((i) => `**${i.name}** (₹${Number(i.price).toFixed(0)})`).join(", ")
      return {
        message: topThree
          ? `I'd be happy to help! Our popular items today are ${topThree}. Feel free to ask about anything on the menu!`
          : `Welcome to ${restaurantName}! Ask me about our menu and I'll help you choose.`,
      }
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      // Fallback to mock on API error
      const topThree = menuItems.slice(0, 3).map((i) => `**${i.name}** (₹${Number(i.price).toFixed(0)})`).join(", ")
      return {
        message: topThree
          ? `I'd be happy to help! Our popular items today are ${topThree}.`
          : `Welcome to ${restaurantName}! Ask me about our menu.`,
      }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response. Please try again."

    return { message: content }
  }
}
