import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PayloadSchema = z.object({
  cliente_id: z.string().uuid().optional(),
  cliente_nome: z.string().min(1).max(255).optional(),
  score: z.number().int().min(0).max(10),
  comentario: z.string().max(5000).optional().nullable(),
  respondido_em: z.string().datetime().optional(),
  source: z.string().max(64).optional(),
  source_id: z.string().max(255).optional(),
}).refine((d) => d.cliente_id || d.cliente_nome, {
  message: "cliente_id ou cliente_nome é obrigatório",
});

function verify(signatureHeader: string | null, body: string, secret: string) {
  if (!signatureHeader) return false;
  const sig = signatureHeader.replace(/^sha256=/, "");
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/hooks/nps")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.NPS_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Server not configured", { status: 500 });
        }

        const body = await request.text();
        const signature =
          request.headers.get("x-webhook-signature") ||
          request.headers.get("x-signature") ||
          request.headers.get("x-hub-signature-256");

        if (!verify(signature, body, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let json: unknown;
        try {
          json = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = PayloadSchema.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: parsed.error.flatten() }, { status: 400 });
        }
        const p = parsed.data;

        // Resolve cliente_id
        let clienteId = p.cliente_id;
        if (!clienteId && p.cliente_nome) {
          const { data, error } = await supabaseAdmin
            .from("clientes")
            .select("id")
            .ilike("nome", p.cliente_nome)
            .limit(1)
            .maybeSingle();
          if (error) {
            return new Response(`DB error: ${error.message}`, { status: 500 });
          }
          if (!data) {
            return Response.json({ error: "Cliente não encontrado" }, { status: 404 });
          }
          clienteId = data.id;
        }

        const respondido_em = p.respondido_em ?? new Date().toISOString();

        // Idempotent insert when source + source_id present
        if (p.source && p.source_id) {
          const { data: existing } = await supabaseAdmin
            .from("cliente_nps")
            .select("id")
            .eq("source", p.source)
            .eq("source_id", p.source_id)
            .maybeSingle();
          if (existing) {
            return Response.json({ ok: true, deduped: true, id: existing.id });
          }
        }

        const { data, error } = await supabaseAdmin
          .from("cliente_nps")
          .insert({
            cliente_id: clienteId!,
            score: p.score,
            comentario: p.comentario ?? null,
            respondido_em,
            source: p.source ?? null,
            source_id: p.source_id ?? null,
          })
          .select("id")
          .single();

        if (error) {
          return new Response(`Insert error: ${error.message}`, { status: 500 });
        }

        return Response.json({ ok: true, id: data.id });
      },
    },
  },
});
