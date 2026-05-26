import { createServerFn } from "@tanstack/react-start";
import { runNotionSync } from "./notion-sync.server";

export const triggerNotionSync = createServerFn({ method: "POST" }).handler(async () => {
  return runNotionSync();
});
