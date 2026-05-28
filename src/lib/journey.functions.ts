import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { migrarJourneyTodosClientes, avancarStepCliente } from "./journey.server";

export const migrarJourney = createServerFn({ method: "POST" }).handler(async () => {
  return migrarJourneyTodosClientes();
});

export const avancarStep = createServerFn({ method: "POST" })
  .inputValidator((input: { stepId: string }) =>
    z.object({ stepId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    return avancarStepCliente(data.stepId);
  });
