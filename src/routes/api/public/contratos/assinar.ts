import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const Body = z.object({
  token: z.string().min(10),
  nome_completo: z.string().min(2),
  documento: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  aceite_termos: z.literal(true),
  assinatura_imagem: z.string().optional().nullable(),
  assinatura_texto: z.string().optional().nullable(),
});

function getClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/public/contratos/assinar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = Body.parse(await request.json());
          const supa = getClient();

          const { data: doc, error: e1 } = await supa
            .from("contratos_documentos")
            .select("id, status, corpo, documento_hash")
            .eq("token_publico", body.token)
            .maybeSingle();
          if (e1) throw new Error(e1.message);
          if (!doc) return Response.json({ error: "Contrato não encontrado" }, { status: 404 });
          if (doc.status === "assinado") return Response.json({ error: "Contrato já assinado" }, { status: 409 });
          if (doc.status !== "enviado") return Response.json({ error: "Contrato não está disponível para assinatura" }, { status: 400 });

          const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || null;
          const ua = request.headers.get("user-agent") || null;

          const { error: e2 } = await supa.from("contratos_assinaturas").insert({
            contrato_id: doc.id,
            nome_completo: body.nome_completo,
            documento: body.documento ?? null,
            email: body.email ?? null,
            ip,
            user_agent: ua,
            assinatura_imagem: body.assinatura_imagem ?? null,
            assinatura_texto: body.assinatura_texto ?? null,
            documento_hash: doc.documento_hash,
            aceite_termos: true,
          });
          if (e2) throw new Error(e2.message);

          const { error: e3 } = await supa
            .from("contratos_documentos")
            .update({
              status: "assinado",
              assinado_em: new Date().toISOString(),
              signatario_nome: body.nome_completo,
              signatario_email: body.email ?? null,
              signatario_documento: body.documento ?? null,
            })
            .eq("id", doc.id);
          if (e3) throw new Error(e3.message);

          return Response.json({ ok: true });
        } catch (err: any) {
          return Response.json({ error: err?.message ?? "Erro ao assinar" }, { status: 400 });
        }
      },
    },
  },
});
