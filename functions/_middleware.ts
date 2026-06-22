import type { Env } from "./_lib/types";
import { error, requireAccess } from "./_lib/http";

export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    requireAccess(context.request, context.env);
    return context.next();
  } catch (err) {
    if (err instanceof Error && "status" in err) {
      const status = Number((err as Error & { status: number }).status) || 401;
      return error(status, err.message);
    }
    return error(401, "Cloudflare Access login is required");
  }
};
