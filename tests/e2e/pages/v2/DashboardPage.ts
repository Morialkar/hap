import { Page, expect } from "@playwright/test";

export class DashboardPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/");
  }

  async expectReady(): Promise<void> {
    await expect(this.page).toHaveTitle(/Eusebe/i);
  }

  async counts(): Promise<{ ouvrages: number; auteurs: number; periodiques: number }> {
    const h2s = this.page.locator("h2");
    const texts = await h2s.allTextContents();
    const nums = texts.map((t) => parseInt(t.trim(), 10)).filter((n) => !isNaN(n));
    return { ouvrages: nums[0], auteurs: nums[1], periodiques: nums[2] };
  }

  async expectCounts(ouvrages: number, auteurs: number, periodiques: number): Promise<void> {
    const c = await this.counts();
    expect(c.ouvrages).toBe(ouvrages);
    expect(c.auteurs).toBe(auteurs);
    expect(c.periodiques).toBe(periodiques);
  }
}
