import { expect, Page } from "@playwright/test";

export type BrowseDimension = "titre" | "auteurs" | "dates" | "genre" | "categorie";

export class BrowseOuvragePage {
  constructor(private page: Page) {}

  async goto(dimension: BrowseDimension): Promise<void> {
    await this.page.goto(`/view/ouvrage/${dimension}`);
  }

  async expectReady(): Promise<void> {
    await expect(this.page).toHaveTitle(/Eusebe/i);
  }

  async dimensionLinks(): Promise<Array<{ label: string; href: string }>> {
    const anchors = this.page.locator("a[href*='/view/ouvrage/']").filter({
      hasNot: this.page.locator("[class*='menu']"),
    });
    const count = await anchors.count();
    const results: Array<{ label: string; href: string }> = [];
    for (let i = 0; i < count; i++) {
      const a = anchors.nth(i);
      results.push({
        label: (await a.textContent()) ?? "",
        href: (await a.getAttribute("href")) ?? "",
      });
    }
    return results;
  }

  async ouvrageLinks(): Promise<Array<{ id: number; titre: string }>> {
    const anchors = this.page.locator("a[href*='/view/ouvrage/id/']");
    const count = await anchors.count();
    const results: Array<{ id: number; titre: string }> = [];
    for (let i = 0; i < count; i++) {
      const a = anchors.nth(i);
      const href = (await a.getAttribute("href")) ?? "";
      const m = href.match(/\/view\/ouvrage\/id\/(\d+)/);
      if (m) results.push({ id: parseInt(m[1], 10), titre: (await a.textContent()) ?? "" });
    }
    return results;
  }

  async openFirst(): Promise<OuvrageDetailPage> {
    const first = this.page.locator("a[href*='/view/ouvrage/id/']").first();
    await first.click();
    return new OuvrageDetailPage(this.page);
  }

  async openFirstDimensionResult(dimension: Exclude<BrowseDimension, "titre">): Promise<void> {
    const legacyDimension = dimension === "auteurs" ? "auteur" : dimension;
    await this.page.locator(`a[href*='/view/ouvrage/${legacyDimension}/']`).first().click();
  }

  async openFirstOuvrageFromCurrentList(): Promise<OuvrageDetailPage> {
    const first = this.page.locator("a[href*='/view/ouvrage/id/']").first();
    await expect(first).toBeVisible();
    await first.click();
    return new OuvrageDetailPage(this.page);
  }
}

export class OuvrageDetailPage {
  constructor(private page: Page) {}

  async goto(id: number): Promise<void> {
    await this.page.goto(`/view/ouvrage/id/${id}`);
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

  async clickEdit(): Promise<void> {
    await this.page.locator("a[href*='/editer/ouvrage/']").first().click();
  }

  async clickDelete(): Promise<void> {
    await this.page.locator("a[href*='/delete/ouvrage/']").first().click();
  }

  async deleteViaLegacyEndpoint(id: number): Promise<{ status: number; bodyLength: number }> {
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => r.url().includes(`/delete/ouvrage/${id}`)),
      this.page.goto(`/delete/ouvrage/${id}`),
    ]);

    return {
      status: response.status(),
      bodyLength: (await response.body()).length,
    };
  }

  async expectOuvrageGone(id: number, title: string): Promise<void> {
    await this.page.request.get(`/view/ouvrage/id/${id}`);
    await expect(this.page.locator("body")).not.toContainText(title);
  }
}
