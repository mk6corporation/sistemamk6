import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contrato/ver/$token")({
  component: VerPage,
});

type Doc = {
  id: string; titulo: string; corpo: string; status: string;
  signatario_nome: string | null; signatario_email: string | null; signatario_documento: string | null;
  variaveis: Record<string, string> | null;
  assinado_em: string | null; assinado_admin_em: string | null; documento_hash: string | null;
};

type Ass = {
  id: string; nome_completo: string; documento: string | null; email: string | null;
  ip: string | null; created_at: string; documento_hash: string | null;
  assinatura_imagem: string | null; assinatura_texto: string | null; tipo: string;
};

function renderVars(body: string, vars: Record<string, string>): string {
  const all: Record<string, string> = { ...vars, data_assinatura: new Date().toLocaleDateString("pt-BR") };
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k: string) => (all[k] ?? "").toString() || "__________");
}

function VerPage() {
  const { token } = Route.useParams();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [assinaturas, setAssinaturas] = useState<Ass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("contratos_documentos")
        .select("id, titulo, corpo, status, signatario_nome, signatario_email, signatario_documento, variaveis, assinado_em, assinado_admin_em, documento_hash")
        .eq("token_publico", token)
        .maybeSingle();
      if (error || !data) { setError("Link inválido ou expirado."); setLoading(false); return; }
      setDoc(data as Doc);
      const { data: ass } = await supabase
        .from("contratos_assinaturas")
        .select("id, nome_completo, documento, email, ip, created_at, documento_hash, assinatura_imagem, assinatura_texto, tipo")
        .eq("contrato_id", data.id)
        .order("created_at", { ascending: true });
      setAssinaturas((ass ?? []) as Ass[]);
      setLoading(false);
    })();
  }, [token]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error || !doc) return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md p-6 text-center">
        <h1 className="mb-2 text-xl font-semibold">Não foi possível abrir</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
      </Card>
    </div>
  );

  const clienteSig = assinaturas.find((a) => a.tipo === "cliente");
  const adminSig = assinaturas.find((a) => a.tipo === "admin");

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 print:p-0">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">{doc.titulo}</h1>
          <Badge>{doc.status}</Badge>
        </div>
        <button onClick={() => window.print()} className="text-sm text-primary underline">Imprimir / PDF</button>
      </div>

      <Card className="p-6">
        <div className="max-h-[70vh] overflow-y-auto whitespace-pre-wrap rounded border bg-muted/30 p-4 text-sm leading-relaxed print:max-h-none print:border-0 print:bg-transparent">
          {renderVars(doc.corpo, (doc.variaveis ?? {}) as Record<string, string>)}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="space-y-2 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4" /> Assinatura da CONTRATADA (MK6)
          </div>
          {adminSig ? (
            <div className="space-y-1 text-xs">
              <div><b>{adminSig.nome_completo}</b>{adminSig.documento ? ` — ${adminSig.documento}` : ""}</div>
              {adminSig.email && <div className="text-muted-foreground">{adminSig.email}</div>}
              <div className="text-muted-foreground">Em: {new Date(adminSig.created_at).toLocaleString("pt-BR")}</div>
              {adminSig.assinatura_imagem && <img src={adminSig.assinatura_imagem} alt="assinatura" className="mt-2 max-h-24 rounded border bg-white" />}
            </div>
          ) : <div className="text-xs text-muted-foreground">Aguardando assinatura</div>}
        </Card>

        <Card className="space-y-2 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" /> Assinatura do CONTRATANTE
          </div>
          {clienteSig ? (
            <div className="space-y-1 text-xs">
              <div><b>{clienteSig.nome_completo}</b>{clienteSig.documento ? ` — ${clienteSig.documento}` : ""}</div>
              {clienteSig.email && <div className="text-muted-foreground">{clienteSig.email}</div>}
              <div className="text-muted-foreground">IP: {clienteSig.ip ?? "—"}</div>
              <div className="text-muted-foreground">Em: {new Date(clienteSig.created_at).toLocaleString("pt-BR")}</div>
              {clienteSig.assinatura_imagem && <img src={clienteSig.assinatura_imagem} alt="assinatura" className="mt-2 max-h-24 rounded border bg-white" />}
            </div>
          ) : <div className="text-xs text-muted-foreground">Aguardando assinatura do cliente</div>}
        </Card>
      </div>

      {doc.documento_hash && (
        <Card className="p-3 text-xs text-muted-foreground">
          <b>Hash do documento (SHA-256):</b> <code className="break-all">{doc.documento_hash}</code>
          <div className="mt-1">Validade jurídica: MP 2.200-2/2001 e Lei 14.063/2020 — assinatura eletrônica com evidências (IP, data/hora, hash).</div>
        </Card>
      )}
    </div>
  );
}
