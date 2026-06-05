import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Upload, Loader2, AlertTriangle, Database, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { gerarBackup, restaurarBackup } from "@/lib/backup.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const gerarFn = useServerFn(gerarBackup);
  const restaurarFn = useServerFn(restaurarBackup);
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [modo, setModo] = useState<"upsert" | "substituir">("upsert");
  const [ultimoBackup, setUltimoBackup] = useState<{ gerado_em: string; total: number } | null>(null);
  const [ultimaRestauracao, setUltimaRestauracao] = useState<any>(null);

  const backupMut = useMutation({
    mutationFn: () => gerarFn(),
    onSuccess: (arquivo) => {
      const blob = new Blob([JSON.stringify(arquivo, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const data = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url;
      a.download = `backup-mk6-${data}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const total = Object.values(arquivo.contagem).reduce((a, b) => a + b, 0);
      setUltimoBackup({ gerado_em: arquivo.gerado_em, total });
      toast.success("Backup gerado com sucesso", { description: `${total} registros exportados` });
    },
    onError: (e: any) => toast.error("Falha ao gerar backup", { description: e?.message }),
  });

  const restaurarMut = useMutation({
    mutationFn: async () => {
      if (!arquivoSelecionado) throw new Error("Selecione um arquivo de backup.");
      const texto = await arquivoSelecionado.text();
      const arquivo = JSON.parse(texto);
      return restaurarFn({ data: { arquivo, modo } });
    },
    onSuccess: (res) => {
      setUltimaRestauracao(res);
      toast.success("Restauração concluída");
    },
    onError: (e: any) => toast.error("Falha ao restaurar", { description: e?.message }),
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Backup e restauração do banco de dados do sistema
          </p>
        </header>

        {/* Backup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Backup do banco de dados
            </CardTitle>
            <CardDescription>
              Baixa um arquivo JSON com todos os clientes, contratos, NPS, checkins, perfis,
              vendedores e demais tabelas operacionais. Guarde em local seguro.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => backupMut.mutate()}
              disabled={backupMut.isPending}
              size="lg"
            >
              {backupMut.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando backup...</>
              ) : (
                <><Download className="mr-2 h-4 w-4" />Baixar backup agora</>
              )}
            </Button>
            {ultimoBackup && (
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Último backup gerado</AlertTitle>
                <AlertDescription>
                  {new Date(ultimoBackup.gerado_em).toLocaleString("pt-BR")} ·{" "}
                  {ultimoBackup.total} registros
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Restauração */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Restaurar a partir de backup
            </CardTitle>
            <CardDescription>
              Use em caso de perda de dados ou para promover um ambiente. Aceita arquivos JSON
              gerados nesta tela.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Operação sensível</AlertTitle>
              <AlertDescription>
                A restauração escreve direto no banco. Faça um backup atual antes de restaurar.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Arquivo de backup (.json)</Label>
              <input
                ref={inputRef}
                type="file"
                accept="application/json,.json"
                onChange={(e) => setArquivoSelecionado(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground hover:file:bg-primary/90"
              />
              {arquivoSelecionado && (
                <p className="text-xs text-muted-foreground">
                  Selecionado: {arquivoSelecionado.name} ·{" "}
                  {(arquivoSelecionado.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Modo de restauração</Label>
              <RadioGroup value={modo} onValueChange={(v) => setModo(v as any)}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="upsert" id="upsert" className="mt-1" />
                  <Label htmlFor="upsert" className="font-normal">
                    <span className="font-medium">Mesclar (upsert)</span> — atualiza registros
                    existentes e insere novos. Mantém dados que não estão no backup.
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="substituir" id="substituir" className="mt-1" />
                  <Label htmlFor="substituir" className="font-normal">
                    <span className="font-medium text-destructive">Substituir tudo</span> — apaga
                    o conteúdo atual (exceto perfis e papéis) e regrava a partir do backup.
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              onClick={() => {
                if (!arquivoSelecionado) {
                  toast.error("Selecione um arquivo primeiro");
                  return;
                }
                if (
                  modo === "substituir" &&
                  !confirm("Isto vai APAGAR os dados atuais antes de restaurar. Continuar?")
                ) return;
                restaurarMut.mutate();
              }}
              disabled={restaurarMut.isPending || !arquivoSelecionado}
              variant={modo === "substituir" ? "destructive" : "default"}
              size="lg"
            >
              {restaurarMut.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Restaurando...</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" />Restaurar agora</>
              )}
            </Button>

            {ultimaRestauracao && (
              <Alert>
                <Database className="h-4 w-4" />
                <AlertTitle>Restauração concluída</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-1 text-xs">
                    {Object.entries(ultimaRestauracao.resultado as Record<string, any>).map(
                      ([tabela, r]) => (
                        <div key={tabela} className="flex justify-between gap-2">
                          <span className="font-mono">{tabela}</span>
                          <span>
                            {r.inseridos} registros
                            {r.erro && <span className="text-destructive"> · {r.erro}</span>}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
