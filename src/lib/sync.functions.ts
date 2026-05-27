import { createServerFn } from "@tanstack/react-start";
import { runNotionSync } from "./notion-sync.server";
import { syncFinanceiroFormAll } from "./notion-financeiro-sync.server";

export const triggerNotionSync = createServerFn({ method: "POST" }).handler(async () => {
  return runNotionSync();
});

export const triggerFinanceiroSync = createServerFn({ method: "POST" })
  .inputValidator((input: { force?: boolean } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    return syncFinanceiroFormAll({ force: data.force });
  });
