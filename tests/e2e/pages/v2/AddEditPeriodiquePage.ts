import { Page } from "@playwright/test";

export interface PeriodiqueFormData {
  titre: string;
  description?: string;
  descriptionCourte?: string;
  debut?: string;
  fin?: string;
  proprietaire?: string;
  notes?: string;
  frequenceId?: string;
  editeurId?: string;
  imprimeurId?: string;
}

export class AddPeriodiquePage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/ajouter/periodique");
  }

  private async waitForSelect(name: string): Promise<void> {
    await this.page.waitForFunction(
      (sel: string) => {
        const el = document.querySelector(`select[name="${sel}"]`) as HTMLSelectElement | null;
        return el !== null && el.options.length > 1;
      },
      name,
      { timeout: 10000 }
    );
  }

  async fill(data: PeriodiqueFormData): Promise<void> {
    await this.page.locator("textarea[name='titre']").fill(data.titre);
    if (data.description !== undefined)
      await this.page.locator("textarea[name='description']").fill(data.description);
    if (data.descriptionCourte !== undefined)
      await this.page.locator("textarea[name='description_courte']").fill(data.descriptionCourte);
    if (data.debut !== undefined)
      await this.page.locator("input[name='debut']").fill(data.debut);
    if (data.fin !== undefined)
      await this.page.locator("input[name='fin']").fill(data.fin);
    if (data.proprietaire !== undefined)
      await this.page.locator("input[name='proprietaire']").fill(data.proprietaire);
    if (data.notes !== undefined)
      await this.page.locator("textarea[name='notes']").fill(data.notes);
    if (data.frequenceId !== undefined) {
      await this.waitForSelect("frequence");
      await this.page.locator("select[name='frequence']").selectOption(data.frequenceId);
    }
    if (data.editeurId !== undefined) {
      await this.waitForSelect("editeur");
      await this.page.locator("select[name='editeur']").selectOption(data.editeurId);
    }
    if (data.imprimeurId !== undefined) {
      await this.waitForSelect("imprimeur");
      await this.page.locator("select[name='imprimeur']").selectOption(data.imprimeurId);
    }
  }

  async submit(): Promise<void> {
    await this.page.locator("input[type='submit'], button[type='submit']").click();
  }
}

export class EditPeriodiquePage {
  constructor(private page: Page) {}

  async goto(id: number): Promise<void> {
    await this.page.goto(`/editer/periodique/${id}`);
    await this.restoreLegacySelectedReferences();
  }

  private async waitForSelect(name: string): Promise<void> {
    await this.page.waitForFunction(
      (sel: string) => {
        const el = document.querySelector(`select[name="${sel}"]`) as HTMLSelectElement | null;
        return el !== null && el.options.length > 1;
      },
      name,
      { timeout: 10000 }
    );
  }

  private async restoreLegacySelectedReferences(): Promise<void> {
    await Promise.all([
      this.waitForSelect("frequence"),
      this.waitForSelect("editeur"),
      this.waitForSelect("imprimeur"),
    ]);

    const selected = await this.page.evaluate(() => {
      const legacyWindow = window as typeof window & {
        selFreq?: number;
        selEditeur?: number;
        selImprimeur?: number;
      };

      return {
        frequence: String(legacyWindow.selFreq ?? ""),
        editeur: String(legacyWindow.selEditeur ?? ""),
        imprimeur: String(legacyWindow.selImprimeur ?? ""),
      };
    });

    if (selected.frequence) {
      await this.page.locator("select[name='frequence']").selectOption(selected.frequence);
    }
    if (selected.editeur) {
      await this.page.locator("select[name='editeur']").selectOption(selected.editeur);
    }
    if (selected.imprimeur) {
      await this.page.locator("select[name='imprimeur']").selectOption(selected.imprimeur);
    }
  }

  async fill(data: Partial<PeriodiqueFormData>): Promise<void> {
    if (data.titre !== undefined)
      await this.page.locator("textarea[name='titre']").fill(data.titre);
    if (data.description !== undefined)
      await this.page.locator("textarea[name='description']").fill(data.description);
    if (data.debut !== undefined)
      await this.page.locator("input[name='debut']").fill(data.debut);
    if (data.fin !== undefined)
      await this.page.locator("input[name='fin']").fill(data.fin);
    if (data.frequenceId !== undefined) {
      await this.waitForSelect("frequence");
      await this.page.locator("select[name='frequence']").selectOption(data.frequenceId);
    }
    if (data.editeurId !== undefined) {
      await this.waitForSelect("editeur");
      await this.page.locator("select[name='editeur']").selectOption(data.editeurId);
    }
    if (data.imprimeurId !== undefined) {
      await this.waitForSelect("imprimeur");
      await this.page.locator("select[name='imprimeur']").selectOption(data.imprimeurId);
    }
  }

  async submit(): Promise<void> {
    await Promise.all([
      this.page.waitForResponse((response) => {
        return response.url().includes("/editer/periodique/") && response.request().method() === "POST";
      }),
      this.page.locator("form").first().locator("input[type='submit'], button[type='submit']").click(),
    ]);
  }
}
