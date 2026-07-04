import { Page } from "@playwright/test";

export interface OuvrageFormData {
  titre: string;
  description?: string;
  descriptionCourte?: string;
  anneePublication?: string;
  moisPublication?: string;
  nbPage?: string;
  nbEdition?: string;
  notes?: string;
  auteurId?: string;
  typeId?: string;
  categorieId?: string;
  editeurId?: string;
  imprimeurId?: string;
  localisationId?: string;
}

export class AddOuvragePage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/ajouter/ouvrage");
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

  async fill(data: OuvrageFormData): Promise<void> {
    await this.page.locator("textarea[name='titre']").fill(data.titre);
    if (data.description !== undefined)
      await this.page.locator("textarea[name='description']").fill(data.description);
    if (data.descriptionCourte !== undefined)
      await this.page.locator("textarea[name='description_courte']").fill(data.descriptionCourte);
    if (data.anneePublication !== undefined)
      await this.page.locator("input[name='annee_publication']").fill(data.anneePublication);
    if (data.moisPublication !== undefined)
      await this.page.locator("input[name='mois_publication']").fill(data.moisPublication);
    if (data.nbPage !== undefined)
      await this.page.locator("input[name='nb_page']").fill(data.nbPage);
    if (data.nbEdition !== undefined)
      await this.page.locator("input[name='nb_edition']").fill(data.nbEdition);
    if (data.notes !== undefined)
      await this.page.locator("textarea[name='notes']").fill(data.notes);
    if (data.auteurId !== undefined) {
      await this.waitForSelect("auteur");
      await this.page.locator("select[name='auteur']").selectOption(data.auteurId);
    }
    if (data.typeId !== undefined) {
      await this.waitForSelect("type");
      await this.page.locator("select[name='type']").selectOption(data.typeId);
    }
    if (data.categorieId !== undefined) {
      await this.waitForSelect("categorie");
      await this.page.locator("select[name='categorie']").selectOption(data.categorieId);
    }
    if (data.editeurId !== undefined) {
      await this.waitForSelect("editeur");
      await this.page.locator("select[name='editeur']").selectOption(data.editeurId);
    }
    if (data.imprimeurId !== undefined) {
      await this.waitForSelect("imprimeur");
      await this.page.locator("select[name='imprimeur']").selectOption(data.imprimeurId);
    }
    if (data.localisationId !== undefined) {
      await this.waitForSelect("localisation");
      await this.page.locator("select[name='localisation']").selectOption(data.localisationId);
    }
  }

  async submit(): Promise<void> {
    await this.page.locator("input[type='submit'], button[type='submit']").click();
  }

  async successIndicator(): Promise<string> {
    return (await this.page.locator("body").textContent()) ?? "";
  }
}

export class EditOuvragePage {
  constructor(private page: Page) {}

  async goto(id: number): Promise<void> {
    await this.page.goto(`/editer/ouvrage/${id}`);
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

  async fill(data: Partial<OuvrageFormData>): Promise<void> {
    if (data.titre !== undefined)
      await this.page.locator("textarea[name='titre']").fill(data.titre);
    if (data.description !== undefined)
      await this.page.locator("textarea[name='description']").fill(data.description);
    if (data.anneePublication !== undefined)
      await this.page.locator("input[name='annee_publication']").fill(data.anneePublication);
    if (data.nbPage !== undefined)
      await this.page.locator("input[name='nb_page']").fill(data.nbPage);
    if (data.auteurId !== undefined) {
      await this.waitForSelect("auteur");
      await this.page.locator("select[name='auteur']").selectOption(data.auteurId);
    }
    if (data.typeId !== undefined) {
      await this.waitForSelect("type");
      await this.page.locator("select[name='type']").selectOption(data.typeId);
    }
    if (data.categorieId !== undefined) {
      await this.waitForSelect("categorie");
      await this.page.locator("select[name='categorie']").selectOption(data.categorieId);
    }
    if (data.editeurId !== undefined) {
      await this.waitForSelect("editeur");
      await this.page.locator("select[name='editeur']").selectOption(data.editeurId);
    }
    if (data.imprimeurId !== undefined) {
      await this.waitForSelect("imprimeur");
      await this.page.locator("select[name='imprimeur']").selectOption(data.imprimeurId);
    }
    if (data.localisationId !== undefined) {
      await this.waitForSelect("localisation");
      await this.page.locator("select[name='localisation']").selectOption(data.localisationId);
    }
  }

  async submit(): Promise<void> {
    await this.page.locator("input[type='submit'], button[type='submit']").click();
  }
}
