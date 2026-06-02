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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, Star } from "lucide-react";
import type { NpsLink } from "@/lib/nps-utils";

export const Route = createFileRoute("/nps/form/$slug")({
  component: NpsFormPage,
});

const SERVICOS_INTERESSE = [
  "Geração de demanda qualificada",
  "Treinamento e implementação comercial",
  "Social media",
  "RH (Contratação de vendedores)",
  "Landing page",
  "Site institucional",
  "IA de atendimento inicial",
  "Google meu negócio",
  "Nenhum no momento",
] as const;

function ScoreScale({
  value,
  onChange,
  minLabel = "Pouco provável",
  maxLabel = "Muito provável",
}: {
  value: number | null;
  onChange: (n: number) => void;
  minLabel?: string;
  maxLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const sel = value === n;
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
              onClick={() => onChange(n)}
              className={`h-11 w-11 rounded-md border text-sm font-semibold transition ${cls}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

function NpsFormPage() {
  const { slug } = Route.useParams();

  // Pergunta 1
  const [responsavel, setResponsavel] = useState("");
  const [empresa, setEmpresa] = useState("");
  // Pergunta 2
  const [qualidade, setQualidade] = useState<number | null>(null);
  // Pergunta 3
  const [expectativas, setExpectativas] = useState("");
  // Pergunta 4
  const [comunicacao, setComunicacao] = useState<number | null>(null);
  // Pergunta 5
  const [processos, setProcessos] = useState("");
  // Pergunta 6
  const [interesses, setInteresses] = useState<string[]>([]);
  // Pergunta 7
  const [indicaria, setIndicaria] = useState<"Sim" | "Não" | null>(null);
  // Pergunta 8
  const [valoriza, setValoriza] = useState("");
  // Pergunta 9
  const [melhoria, setMelhoria] = useState("");
  // Pergunta 10 (NPS principal)
  const [renovacao, setRenovacao] = useState<number | null>(null);

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

  const toggleInteresse = (s: string) => {
    setInteresses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const podeEnviar =
    responsavel.trim().length > 0 &&
    empresa.trim().length > 0 &&
    qualidade != null &&
    comunicacao != null &&
    renovacao != null &&
    indicaria != null;

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!podeEnviar) throw new Error("Responda as perguntas obrigatórias");
      const respostas = {
        qualidade_servico: qualidade,
        expectativas_resultados: expectativas.trim() || null,
        comunicacao_suporte: comunicacao,
        processos_entregas: processos.trim() || null,
        servicos_interesse: interesses,
        indicaria: indicaria,
        mais_valoriza: valoriza.trim() || null,
        melhoria_sugerida: melhoria.trim() || null,
        probabilidade_renovacao: renovacao,
      };
      const res = await fetch("/api/public/nps/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          responsavel: responsavel.trim(),
          empresa: empresa.trim(),
          score: renovacao, // NPS principal = probabilidade de renovação
          comentario: melhoria.trim() || null,
          respostas,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        let msg = t || "Erro ao enviar";
        try {
          const j = JSON.parse(t);
          if (j?.error) msg = typeof j.error === "string" ? j.error : JSON.stringify(j.error);
        } catch {}
        throw new Error(msg);
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
    <div className="flex min-h-screen items-start justify-center bg-muted/30 p-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Star className="h-3.5 w-3.5" /> Formulário NPS · {link.produto}
          </div>
          <CardTitle className="text-2xl">
            {link.titulo ?? "Formulário NPS [MK6]"}
          </CardTitle>
          <CardDescription>
            {link.descricao ??
              "Queremos entregar resultados cada vez melhores para você. Suas respostas nos ajudam a entender o que está funcionando e onde podemos evoluir. Leva menos de 2 minutos e faz toda a diferença no nosso trabalho juntos."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* 1 */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome do responsável *</Label>
              <Input
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome da empresa *</Label>
              <Input
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Empresa"
              />
            </div>
          </div>

          {/* 2 */}
          <div className="space-y-2">
            <Label>
              Como você avalia a qualidade do serviço que está recebendo atualmente?
              (0 a 10) *
            </Label>
            <ScoreScale
              value={qualidade}
              onChange={setQualidade}
              minLabel="Péssima"
              maxLabel="Excelente"
            />
          </div>

          {/* 3 */}
          <div className="space-y-1.5">
            <Label>
              Os resultados entregues até agora estão alinhados com suas expectativas?
              <span className="ml-1 text-muted-foreground">[comente o motivo]</span>
            </Label>
            <Textarea
              value={expectativas}
              onChange={(e) => setExpectativas(e.target.value)}
              rows={3}
              placeholder="Conte um pouco sobre os resultados..."
            />
          </div>

          {/* 4 */}
          <div className="space-y-2">
            <Label>
              Como você avalia a comunicação e o suporte do nosso time? (0 a 10) *
            </Label>
            <ScoreScale
              value={comunicacao}
              onChange={setComunicacao}
              minLabel="Péssima"
              maxLabel="Excelente"
            />
          </div>

          {/* 5 */}
          <div className="space-y-1.5">
            <Label>
              As entregas e os processos estão sendo claros e bem organizados?
            </Label>
            <Textarea
              value={processos}
              onChange={(e) => setProcessos(e.target.value)}
              rows={3}
              placeholder="Como tem sido a organização das entregas..."
            />
          </div>

          {/* 6 */}
          <div className="space-y-2">
            <Label>
              Temos outros serviços que podem ajudar seu negócio a crescer. Quais
              despertam seu interesse?
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {SERVICOS_INTERESSE.map((s) => {
                const checked = interesses.includes(s);
                return (
                  <label
                    key={s}
                    className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm transition hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleInteresse(s)}
                    />
                    <span>{s}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 7 */}
          <div className="space-y-2">
            <Label>
              Você conhece alguém que poderia se beneficiar dos nossos serviços e
              gostaria de indicar? *
            </Label>
            <div className="flex gap-2">
              {(["Sim", "Não"] as const).map((opt) => {
                const sel = indicaria === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setIndicaria(opt)}
                    className={`h-10 rounded-md border px-6 text-sm font-medium transition ${
                      sel
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 8 */}
          <div className="space-y-1.5">
            <Label>O que você mais valoriza no nosso trabalho até aqui?</Label>
            <Textarea
              value={valoriza}
              onChange={(e) => setValoriza(e.target.value)}
              rows={3}
            />
          </div>

          {/* 9 */}
          <div className="space-y-1.5">
            <Label>Se pudéssemos melhorar uma coisa, o que seria?</Label>
            <Textarea
              value={melhoria}
              onChange={(e) => setMelhoria(e.target.value)}
              rows={3}
            />
          </div>

          {/* 10 */}
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <Label className="text-base">
              Se este contrato se encerrasse hoje, em uma escala de 0 a 10, qual a
              chance de você renovar ou continuar a parceria conosco? *
            </Label>
            <ScoreScale value={renovacao} onChange={setRenovacao} />
          </div>

          {submitMut.error && (
            <p className="text-sm text-red-600">
              {(submitMut.error as Error).message}
            </p>
          )}

          <Button
            size="lg"
            className="w-full"
            disabled={submitMut.isPending || !podeEnviar}
            onClick={() => submitMut.mutate()}
          >
            {submitMut.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Enviar avaliação
          </Button>
          {!podeEnviar && (
            <p className="text-center text-xs text-muted-foreground">
              Preencha os campos marcados com * para enviar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
