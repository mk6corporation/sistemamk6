import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RespostasSchema = z
  .object({
    qualidade_servico: z.number().int().min(0).max(10).nullable().optional(),
    expectativas_resultados: z.string().max(5000).nullable().optional(),
    comunicacao_suporte: z.number().int().min(0).max(10).nullable().optional(),
    processos_entregas: z.string().max(5000).nullable().optional(),
    servicos_interesse: z.array(z.string().min(1).max(120)).max(20).optional(),
    indicaria: z.enum(["Sim", "Não"]).nullable().optional(),
    mais_valoriza: z.string().max(5000).nullable().optional(),
    melhoria_sugerida: z.string().max(5000).nullable().optional(),
    probabilidade_renovacao: z.number().int().min(0).max(10).nullable().optional(),
  })
  .strict();

const Schema = z.object({
  slug: z.string().min(1).max(80),
  responsavel: z.string().min(1).max(255).optional(),
  empresa: z.string().min(1).max(255),
  score: z.number().int().min(0).max(10),
  comentario: z.string().max(5000).nullable().optional(),
  respostas: RespostasSchema.optional(),
});

export const Route = createFileRoute("/api/public/nps/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = Schema.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: parsed.error.flatten() }, { status: 400 });
        }
        const { slug, responsavel, empresa, score, comentario, respostas } =
          parsed.data;

        // Validar link ativo
        const { data: link, error: linkErr } = await supabaseAdmin
          .from("nps_links")
          .select("id,slug,produto,ativo")
          .eq("slug", slug)
          .eq("ativo", true)
          .maybeSingle();
        if (linkErr) return new Response(linkErr.message, { status: 500 });
        if (!link) return new Response("Link inválido", { status: 404 });

        // Encontrar cliente por nome
        const { data: cliente, error: clienteErr } = await supabaseAdmin
          .from("clientes")
          .select("id")
          .ilike("nome", empresa)
          .limit(1)
          .maybeSingle();
        if (clienteErr) return new Response(clienteErr.message, { status: 500 });
        if (!cliente) {
          return Response.json(
            { error: "Empresa não encontrada na nossa base. Verifique o nome." },
            { status: 404 },
          );
        }

        const source = `form:${slug}`;
        const source_id = `${cliente.id}:${Date.now()}`;

        const { data, error } = await supabaseAdmin
          .from("cliente_nps")
          .insert({
            cliente_id: cliente.id,
            score,
            comentario: comentario ?? null,
            respondido_em: new Date().toISOString(),
            source,
            source_id,
            responsavel: responsavel ?? null,
            respostas: respostas ?? {},
          })
          .select("id")
          .single();

        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true, id: data.id });
      },
    },
  },
});
