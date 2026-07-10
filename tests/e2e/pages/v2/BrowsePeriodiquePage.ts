import { expect, Page } from "@playwright/test";

export class BrowsePeriodiquePage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/view/periodique/titre");
  }

  async expectReady(): Promise<void> {
    await expect(this.page).toHaveTitle(/Eusebe/i);
  }

  async periodiqueLinks(): Promise<Array<{ id: number; titre: string }>> {
    const anchors = this.page.locator("a[href*='/view/periodique/id/']");
    const count = await anchors.count();
    const results: Array<{ id: number; titre: string }> = [];
    for (let i = 0; i < count; i++) {
      const a = anchors.nth(i);
      const href = (await a.getAttribute("href")) ?? "";
      const m = href.match(/\/view\/periodique\/id\/(\d+)/);
      if (m) results.push({ id: parseInt(m[1], 10), titre: (await a.textContent()) ?? "" });
    }
    return results;
  }

  async openFirst(): Promise<PeriodiqueDetailPage> {
    await this.page.locator("a[href*='/view/periodique/id/']").first().click();
    return new PeriodiqueDetailPage(this.page);
  }
}

export class PeriodiqueDetailPage {
  constructor(private page: Page) {}

  async goto(id: number): Promise<void> {
    await this.page.goto(`/view/periodique/id/${id}`);
  }

  async titre(): Promise<string> {
    const h1 = this.page.locator("h1").first();
    const raw = await h1.innerText();
    return raw.replace(/\s+/g, " ").trim();
  }

  async field(label: string): Promise<string> {
    const spans = this.page.locator(".twocolumn span");
    const count = await spans.count();
    for (let i = 0; i < count; i++) {
      const text = (await spans.nth(i).textContent()) ?? "";
      const colon = text.indexOf(":");
      if (colon > 0 && text.slice(0, colon).trim() === label) {
        return text.slice(colon + 1).trim();
      }
    }
    return "";
  }

  async fields(): Promise<Record<string, string>> {
    const spans = this.page.locator(".twocolumn span");
    const count = await spans.count();
    const result: Record<string, string> = {};
    for (let i = 0; i < count; i++) {
      const text = (await spans.nth(i).textContent()) ?? "";
      const colon = text.indexOf(":");
      if (colon > 0) {
        result[text.slice(0, colon).trim()] = text.slice(colon + 1).trim();
      }
    }
    return result;
  }
}
