import { Firecrawl } from "firecrawl";

export class FirecrawlService {
  private readonly app: Firecrawl | null;
  constructor() {
    this.app = process.env.FIRECRAWL_API_KEY
      ? new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })
      : null;
  }
  async scrapeUrlContext(url: string): Promise<string | null> {
    if (!this.app) return null;
    try {
      const result = await this.app.scrape(url, { formats: ["markdown"] });
      return result.markdown || null;
    } catch (error) {
      console.warn("Firecrawl scraping failed:", error);
      return null;
    }
  }
}
