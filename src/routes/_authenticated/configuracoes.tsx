import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Upload, Loader2, AlertTriangle, Database, ShieldCheck, Clock, BookOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  gerarBackup,
  restaurarBackup,
  listarBackupsAutomaticos,
  baixarBackupAutomatico,
  executarBackupAgora,
} from "@/lib/backup.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesPage,
});

function formatBytes(n: number) {
  if (!n) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function ConfiguracoesPage() {
  const qc = useQueryClient();
  const gerarFn = useServerFn(gerarBackup);
  const restaurarFn = useServerFn(restaurarBackup);
  const listarFn = useServerFn(listarBackupsAutomaticos);
  const baixarFn = useServerFn(baixarBackupAutomatico);
  const executarAutoFn = useServerFn(executarBackupAgora);

  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [modo, setModo] = useState<"upsert" | "substituir">("upsert");
  const [ultimoBackup, setUltimoBackup] = useState<{ gerado_em: string; total: number } | null>(null);
  const [ultimaRestauracao, setUltimaRestauracao] = useState<any>(null);

  const backupsAuto = useQuery({
    queryKey: ["backups-automaticos"],
    queryFn: () => listarFn(),
  });

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

  const executarAutoMut = useMutation({
    mutationFn: () => executarAutoFn(),
    onSuccess: (r) => {
      toast.success("Backup automático criado", { description: `${r.total} registros · ${r.path}` });
      qc.invalidateQueries({ queryKey: ["backups-automaticos"] });
    },
    onError: (e: any) => toast.error("Falha ao rodar backup", { description: e?.message }),
  });

  const baixarAutoMut = useMutation({
    mutationFn: async (name: string) => {
      const arquivo = await baixarFn({ data: { name } });
      const blob = new Blob([JSON.stringify(arquivo, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e: any) => toast.error("Falha ao baixar", { description: e?.message }),
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
            Backup, restauração e recuperação do sistema
          </p>
        </header>

        {/* Backup manual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Backup manual (download)
            </CardTitle>
            <CardDescription>
              Baixa um arquivo JSON com todos os clientes, contratos, NPS, checkins, perfis,
              vendedores e demais tabelas operacionais. Guarde em local seguro (Google Drive,
              Dropbox, HD externo).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => backupMut.mutate()} disabled={backupMut.isPending} size="lg">
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

        {/* Backups automáticos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Backups automáticos
            </CardTitle>
            <CardDescription>
              O sistema gera automaticamente 1 backup por dia às 03h (horário de Brasília) e
              guarda os últimos 30 dias dentro do próprio banco (storage privado).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => executarAutoMut.mutate()}
                disabled={executarAutoMut.isPending}
              >
                {executarAutoMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Rodar agora
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => qc.invalidateQueries({ queryKey: ["backups-automaticos"] })}
              >
                Atualizar lista
              </Button>
            </div>

            {backupsAuto.isLoading ? (
              <div className="flex h-20 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !backupsAuto.data?.length ? (
              <p className="text-sm text-muted-foreground">
                Nenhum backup automático ainda. O primeiro será gerado na próxima execução
                agendada ou clique em "Rodar agora".
              </p>
            ) : (
              <div className="divide-y rounded-md border">
                {backupsAuto.data.map((b) => (
                  <div key={b.name} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.created_at ? new Date(b.created_at).toLocaleString("pt-BR") : "—"} ·{" "}
                        {formatBytes(b.size)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => baixarAutoMut.mutate(b.name)}
                      disabled={baixarAutoMut.isPending}
                    >
                      <Download className="mr-1 h-3 w-3" /> Baixar
                    </Button>
                  </div>
                ))}
              </div>
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
              gerados nesta tela ou baixados dos backups automáticos.
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

        {/* Guia de recuperação total */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Guia: como recuperar o sistema do zero
            </CardTitle>
            <CardDescription>
              Passo a passo caso o projeto seja perdido ou você precise montar um ambiente novo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                <strong>Mantenha sempre um backup recente em local externo.</strong> Os
                backups automáticos diários ficam dentro do próprio banco — por isso, baixe
                manualmente pelo menos uma vez por semana e guarde fora do sistema
                (Google Drive, e-mail, HD externo).
              </li>
              <li>
                <strong>Em caso de perda total do projeto:</strong> acesse o Lovable, crie
                um novo projeto a partir do repositório/código atual e publique. O backend
                (banco) é recriado automaticamente com a estrutura das tabelas via
                migrações.
              </li>
              <li>
                <strong>Cadastre o primeiro usuário admin:</strong> faça signup pela tela
                de login normalmente. O primeiro usuário precisa receber o papel de admin
                no banco (peça suporte se necessário) para acessar esta tela.
              </li>
              <li>
                <strong>Restaure os dados:</strong> volte nesta página, faça upload do
                arquivo JSON mais recente que você salvou e use o modo{" "}
                <span className="font-mono">Mesclar (upsert)</span>. Em segundos todos os
                clientes, contratos, NPS, vendedores e histórico voltam.
              </li>
              <li>
                <strong>Verifique:</strong> abra a lista de clientes, dashboard e NPS para
                confirmar que os números batem com o backup.
              </li>
            </ol>

            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Boas práticas</AlertTitle>
              <AlertDescription className="space-y-1">
                <p>· Baixe um backup manual antes de mudanças grandes.</p>
                <p>· Teste a restauração em um ambiente de testes pelo menos uma vez.</p>
                <p>· O modo "Substituir tudo" é destrutivo — só use se tiver certeza.</p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
