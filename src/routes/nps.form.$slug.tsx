import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Star } from "lucide-react";
import type { NpsLink } from "@/lib/nps-utils";

export const Route = createFileRoute("/nps/form/$slug")({
  component: NpsFormPage,
});

function NpsFormPage() {
  const { slug } = Route.useParams();
  const [empresa, setEmpresa] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviado, setEnviado] = useState(false);

  const linkQuery = useQuery({
    queryKey: ["nps-link-public", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nps_links")
        .select("*")
        .eq("slug", slug)
        .eq("ativo", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data as NpsLink;
    },
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      if (score == null) throw new Error("Escolha uma nota");
      if (!empresa.trim()) throw new Error("Informe o nome da empresa");
      const res = await fetch("/api/public/nps/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          empresa: empresa.trim(),
          score,
          comentario: comentario.trim() || null,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Erro ao enviar");
      }
    },
    onSuccess: () => setEnviado(true),
  });

  if (linkQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (linkQuery.error || !linkQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Link inválido</CardTitle>
            <CardDescription>
              Este link de NPS não existe ou foi desativado.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const link = linkQuery.data;

  if (enviado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <CardTitle>Obrigado pela sua resposta!</CardTitle>
            <CardDescription>
              Sua avaliação foi registrada. Iremos analisar com muito carinho.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Star className="h-3.5 w-3.5" /> Pesquisa de NPS · {link.produto}
          </div>
          <CardTitle className="text-2xl">
            {link.titulo ?? `Como você avalia o ${link.produto}?`}
          </CardTitle>
          {link.descricao && <CardDescription>{link.descricao}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1.5">
            <Label>Nome da empresa *</Label>
            <Input
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Digite o nome da sua empresa"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Em uma escala de 0 a 10, o quanto você recomendaria nosso serviço? *
            </Label>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 11 }, (_, i) => i).map((n) => {
                const sel = score === n;
                const cls =
                  n <= 6
                    ? sel
                      ? "bg-red-600 text-white border-red-600"
                      : "hover:bg-red-50 hover:border-red-300"
                    : n <= 8
                      ? sel
                        ? "bg-amber-500 text-white border-amber-500"
                        : "hover:bg-amber-50 hover:border-amber-300"
                      : sel
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "hover:bg-emerald-50 hover:border-emerald-300";
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScore(n)}
                    className={`h-11 w-11 rounded-md border text-sm font-semibold transition ${cls}`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Pouco provável</span>
              <span>Muito provável</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Comentário (opcional)</Label>
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Conte um pouco mais sobre sua experiência..."
              rows={4}
            />
          </div>

          {submitMut.error && (
            <p className="text-sm text-red-600">{(submitMut.error as Error).message}</p>
          )}

          <Button
            size="lg"
            className="w-full"
            disabled={submitMut.isPending || score == null || !empresa.trim()}
            onClick={() => submitMut.mutate()}
          >
            {submitMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar avaliação
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
