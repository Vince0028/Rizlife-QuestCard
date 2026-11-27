import { createPortalMiddleware } from "@rizlife/shared/portal-middleware";

export const middleware = createPortalMiddleware("teacher", { publicPrefixes: ["/api/cron/"] });

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
