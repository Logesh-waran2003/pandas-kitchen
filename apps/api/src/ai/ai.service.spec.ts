import { AiService } from "./ai.service"

function makePrisma() {
  return {
    restaurant: { findUnique: jest.fn() },
    menuItem: { findMany: jest.fn() },
  }
}

function makeConfig() {
  return { get: jest.fn() }
}

const RESTAURANT_ID = "rest-1"
const USER_MESSAGES = [{ role: "user", content: "What do you recommend?" }]

describe("AiService", () => {
  let service: AiService
  let prisma: ReturnType<typeof makePrisma>
  let config: ReturnType<typeof makeConfig>

  beforeEach(() => {
    prisma = makePrisma()
    config = makeConfig()
    service = new AiService(prisma as any, config as any)
    global.fetch = jest.fn()

    // Default: restaurant exists, no API key
    prisma.restaurant.findUnique.mockResolvedValue({ name: "Pandas Kitchen" })
    prisma.menuItem.findMany.mockResolvedValue([
      { name: "Butter Chicken", price: 280, description: "Creamy curry", isVeg: false },
      { name: "Paneer Tikka", price: 220, description: "Grilled paneer", isVeg: true },
      { name: "Biryani", price: 320, description: "Aromatic rice", isVeg: false },
    ])
    config.get.mockReturnValue(undefined) // no API key by default
  })

  // ── no API key ─────────────────────────────────────────────────────────────

  describe("when no OPENAI_API_KEY is configured", () => {
    it("returns mock response mentioning top 3 menu items", async () => {
      const result = await service.chat(RESTAURANT_ID, USER_MESSAGES)

      expect(result.message).toContain("Butter Chicken")
      expect(result.message).toContain("Paneer Tikka")
      expect(result.message).toContain("Biryani")
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it("empty menu → returns welcome message without crashing", async () => {
      prisma.menuItem.findMany.mockResolvedValue([])

      const result = await service.chat(RESTAURANT_ID, USER_MESSAGES)

      expect(result.message).toBeTruthy()
      expect(typeof result.message).toBe("string")
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  // ── with API key ───────────────────────────────────────────────────────────

  describe("when OPENAI_API_KEY is set", () => {
    beforeEach(() => {
      config.get.mockReturnValue("sk-test-key")
    })

    it("fetch succeeds → returns message from choices[0].message.content", async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: "I recommend the Butter Chicken!" } }],
        }),
      })

      const result = await service.chat(RESTAURANT_ID, USER_MESSAGES)

      expect(result.message).toBe("I recommend the Butter Chicken!")
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/chat/completions",
        expect.objectContaining({ method: "POST" }),
      )
    })

    it("fetch fails (ok: false) → falls back to mock response without throwing", async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: jest.fn(),
      })

      const result = await service.chat(RESTAURANT_ID, USER_MESSAGES)

      // Should not throw — returns a fallback string
      expect(result.message).toBeTruthy()
      expect(typeof result.message).toBe("string")
    })

    it("sends Authorization header with Bearer token", async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: "Here's what I suggest." } }],
        }),
      })

      await service.chat(RESTAURANT_ID, USER_MESSAGES)

      const [, init] = (global.fetch as jest.Mock).mock.calls[0]
      expect(init.headers["Authorization"]).toBe("Bearer sk-test-key")
    })
  })

  // ── restaurant not found ───────────────────────────────────────────────────

  describe("restaurant not found", () => {
    it('uses "our restaurant" as fallback name and still returns a response', async () => {
      prisma.restaurant.findUnique.mockResolvedValue(null)

      const result = await service.chat(RESTAURANT_ID, USER_MESSAGES)

      expect(result.message).toBeTruthy()
      expect(typeof result.message).toBe("string")
    })
  })
})
