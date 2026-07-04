import { Page, expect } from "@playwright/test";

export interface AnnexGroup {
  year: string;
  entryCount: number;
}

export class AnnexPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/annex");
  }

  async yearGroups(): Promise<AnnexGroup[]> {
    const h2s = this.page.locator("h2");
    const count = await h2s.count();
    const groups: AnnexGroup[] = [];
    for (let i = 0; i < count; i++) {
      const year = (await h2s.nth(i).textContent()) ?? "";
      groups.push({ year: year.trim(), entryCount: 0 });
    }
    return groups;
  }

  async expectFirstGroupYear(year: string): Promise<void> {
    const first = this.page.locator("h2").first();
    await expect(first).toHaveText(year);
  }

  async expectHasGroups(): Promise<void> {
    const count = await this.page.locator("h2").count();
    expect(count).toBeGreaterThan(0);
  }

  async firstEntryText(): Promise<string> {
    const firstItem = this.page.locator("li em").first();
    return (await firstItem.textContent()) ?? "";
  }
}
