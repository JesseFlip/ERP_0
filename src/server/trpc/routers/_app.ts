import { router } from "../trpc";
import { catalogRouter } from "./catalog";
import { customersRouter } from "./customers";
import { jobsRouter } from "./jobs";
import { invoicesRouter } from "./invoices";
import { qboRouter } from "./qbo";
import { uploadsRouter } from "./uploads";
import { dashboardRouter } from "./dashboard";
import { crewsRouter } from "./crews";
import { estimatesRouter } from "./estimates";

export const appRouter = router({
  catalog: catalogRouter,
  customers: customersRouter,
  jobs: jobsRouter,
  invoices: invoicesRouter,
  qbo: qboRouter,
  uploads: uploadsRouter,
  dashboard: dashboardRouter,
  crews: crewsRouter,
  estimates: estimatesRouter,
});

export type AppRouter = typeof appRouter;
