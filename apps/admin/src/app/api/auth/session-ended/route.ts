import { createSessionEndedHandler } from "@rizlife/shared/portal-auth";

export const dynamic = "force-dynamic";

/** Clears a revoked session cookie and returns to the login page. */
export const GET = createSessionEndedHandler("admin");
