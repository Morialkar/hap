import { bootstrapV3 } from "./helpers/bootstrap-v3";

export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_TARGET !== "v3") {
    return;
  }

  if (process.env.E2E_V3_BOOTSTRAP !== "1") {
    return;
  }

  bootstrapV3();
}
