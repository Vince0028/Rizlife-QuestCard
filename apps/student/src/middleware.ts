import { createPortalMiddleware } from "@rizlife/shared/portal-middleware";

export const middleware = createPortalMiddleware("student");

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
