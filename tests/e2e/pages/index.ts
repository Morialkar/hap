import {
  AddOuvragePage as V2AddOuvragePage,
  EditOuvragePage as V2EditOuvragePage,
} from "./v2/AddEditOuvragePage";
import {
  AddPeriodiquePage as V2AddPeriodiquePage,
  EditPeriodiquePage as V2EditPeriodiquePage,
} from "./v2/AddEditPeriodiquePage";
import { AnnexPage as V2AnnexPage } from "./v2/AnnexPage";
import {
  BrowseOuvragePage as V2BrowseOuvragePage,
  OuvrageDetailPage as V2OuvrageDetailPage,
} from "./v2/BrowseOuvragePage";
import {
  BrowsePeriodiquePage as V2BrowsePeriodiquePage,
  PeriodiqueDetailPage as V2PeriodiqueDetailPage,
} from "./v2/BrowsePeriodiquePage";
import { DashboardPage as V2DashboardPage } from "./v2/DashboardPage";
import {
  AddOuvragePage as V3AddOuvragePage,
  AddPeriodiquePage as V3AddPeriodiquePage,
  AnnexPage as V3AnnexPage,
  BrowseOuvragePage as V3BrowseOuvragePage,
  BrowsePeriodiquePage as V3BrowsePeriodiquePage,
  DashboardPage as V3DashboardPage,
  EditOuvragePage as V3EditOuvragePage,
  EditPeriodiquePage as V3EditPeriodiquePage,
  OuvrageDetailPage as V3OuvrageDetailPage,
  PeriodiqueDetailPage as V3PeriodiqueDetailPage,
} from "./v3/V3App";

export type { BrowseDimension } from "./v2/BrowseOuvragePage";
export type { OuvrageFormData } from "./v2/AddEditOuvragePage";
export type { PeriodiqueFormData } from "./v2/AddEditPeriodiquePage";

const useV3 = process.env.E2E_TARGET === "v3";

export const DashboardPage = useV3 ? V3DashboardPage : V2DashboardPage;
export const AnnexPage = useV3 ? V3AnnexPage : V2AnnexPage;
export const BrowseOuvragePage = useV3 ? V3BrowseOuvragePage : V2BrowseOuvragePage;
export const OuvrageDetailPage = useV3 ? V3OuvrageDetailPage : V2OuvrageDetailPage;
export const BrowsePeriodiquePage = useV3 ? V3BrowsePeriodiquePage : V2BrowsePeriodiquePage;
export const PeriodiqueDetailPage = useV3 ? V3PeriodiqueDetailPage : V2PeriodiqueDetailPage;
export const AddOuvragePage = useV3 ? V3AddOuvragePage : V2AddOuvragePage;
export const EditOuvragePage = useV3 ? V3EditOuvragePage : V2EditOuvragePage;
export const AddPeriodiquePage = useV3 ? V3AddPeriodiquePage : V2AddPeriodiquePage;
export const EditPeriodiquePage = useV3 ? V3EditPeriodiquePage : V2EditPeriodiquePage;
