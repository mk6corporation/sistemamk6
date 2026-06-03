import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { scoreBadgeClasses } from "@/lib/nps-utils";

type Respostas = {
  qualidade_servico?: number | null;
  expectativas_resultados?: string | null;
  comunicacao_suporte?: number | null;
  processos_entregas?: string | null;
  servicos_interesse?: string[] | null;
  indicaria?: "Sim" | "Não" | null;
  mais_valoriza?: string | null;
  melhoria_sugerida?: string | null;
  probabilidade_renovacao?: number | null;
};

type Props = {
  resposta: {
    id: string;
    score: number;
    comentario: string | null;
    respondido_em: string;
    responsavel?: string | null;
    source?: string | null;
    respostas?: Respostas | Record<string, unknown> | null;
  };
  clienteNome?: string | null;
  trigger?: React.ReactNode;
};

function Linha({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1 border-b pb-3 last:border-b-0 last:pb-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm">{value ?? <span className="text-muted-foreground/60">—</span>}</div>
    </div>
  );
}

function Nota({ n }: { n: number | null | undefined }) {
  if (n == null) return <span className="text-muted-foreground/60">—</span>;
  return (
    <Badge variant="outline" className={scoreBadgeClasses(n)}>
      {n} / 10
    </Badge>
  );
}

export function RespostasCompletasDialog({ resposta, clienteNome, trigger }: Props) {
  const r = (resposta.respostas ?? {}) as Respostas;

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Ver respostas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Respostas completas do NPS</DialogTitle>
          <DialogDescription>
            {clienteNome ? `${clienteNome} · ` : ""}
            {new Date(resposta.respondido_em).toLocaleString("pt-BR")}
            {resposta.responsavel ? ` · ${resposta.responsavel}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={scoreBadgeClasses(resposta.score)}>
              NPS {resposta.score}
            </Badge>
            {resposta.source && (
              <span className="text-xs text-muted-foreground">via {resposta.source}</span>
            )}
          </div>

          <Linha
            label="1. Qualidade do serviço (0-10)"
            value={<Nota n={r.qualidade_servico} />}
          />
          <Linha
            label="2. Resultados x expectativas"
            value={r.expectativas_resultados || null}
          />
          <Linha
            label="3. Comunicação e suporte (0-10)"
            value={<Nota n={r.comunicacao_suporte} />}
          />
          <Linha
            label="4. Entregas e processos"
            value={r.processos_entregas || null}
          />
          <Linha
            label="5. Serviços de interesse"
            value={
              r.servicos_interesse && r.servicos_interesse.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {r.servicos_interesse.map((s) => (
                    <Badge key={s} variant="secondary" className="font-normal">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : null
            }
          />
          <Linha
            label="6. Indicaria para alguém?"
            value={
              r.indicaria ? (
                <Badge
                  variant="outline"
                  className={
                    r.indicaria === "Sim"
                      ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                      : "bg-red-500/15 text-red-700 border-red-500/30"
                  }
                >
                  {r.indicaria}
                </Badge>
              ) : null
            }
          />
          <Linha
            label="7. O que mais valoriza"
            value={r.mais_valoriza || null}
          />
          <Linha
            label="8. Sugestão de melhoria"
            value={r.melhoria_sugerida || null}
          />
          <Linha
            label="9. Probabilidade de renovação (NPS) (0-10)"
            value={<Nota n={r.probabilidade_renovacao} />}
          />
          {resposta.comentario && (
            <Linha label="Comentário geral" value={resposta.comentario} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
