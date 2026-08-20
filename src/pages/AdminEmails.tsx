import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, RefreshCw, Mail, ScrollText, Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import useSEO from "@/hooks/use-seo";
import logo from "@/assets/logo.png";


type TemplateMeta = { name: string; displayName: string; hasPreviewData: boolean; subject: string };
type LogRow = {
  id: string; message_id: string | null; template_name: string;
  recipient_email: string; status: string; error_message: string | null;
  metadata: any; created_at: string; attempts: number; history: any[];
};
type OrderRow = { id: string; total: number; status: string; payment_method: string; created_at: string; customer_info: any };

async function callTool(payload: any) {
  const { data, error } = await supabase.functions.invoke("admin-email-tools", { body: payload });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

const statusColor: Record<string, string> = {
  sent: "bg-green-500/20 text-green-700 dark:text-green-300",
  pending: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  failed: "bg-red-500/20 text-red-700 dark:text-red-300",
  dlq: "bg-red-600/30 text-red-800 dark:text-red-200",
  suppressed: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  bounced: "bg-red-500/20 text-red-700 dark:text-red-300",
  complained: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
};

const AdminEmails = () => {
  useSEO({ title: "Admin · E-mails", noindex: true });
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<string>("");
  const [renderHtml, setRenderHtml] = useState<string>("");
  const [renderSubject, setRenderSubject] = useState<string>("");
  const [renderData, setRenderData] = useState<string>("");
  const [renderLoading, setRenderLoading] = useState(false);

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState({ template: "all", status: "all", search: "" });
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    callTool({ action: "list-templates" }).then((d) => {
      setTemplates(d.templates);
      if (d.templates.length) setSelectedTemplate(d.templates[0].name);
    }).catch((e) => toast.error(`Falha ao listar templates: ${e.message}`));
    callTool({ action: "recent-orders" }).then((d) => setOrders(d.orders)).catch(() => {});
    loadLogs();
  }, []);

  const renderTemplate = async () => {
    if (!selectedTemplate) return;
    setRenderLoading(true);
    try {
      const payload: any = { action: "render", templateName: selectedTemplate };
      if (selectedOrder) payload.orderId = selectedOrder;
      const d = await callTool(payload);
      setRenderHtml(d.html);
      setRenderSubject(d.subject);
      setRenderData(JSON.stringify(d.templateData, null, 2));
    } catch (e: any) {
      toast.error(`Falha ao renderizar: ${e.message}`);
    } finally { setRenderLoading(false); }
  };

  useEffect(() => { if (selectedTemplate) renderTemplate(); /* eslint-disable-next-line */ }, [selectedTemplate, selectedOrder]);

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const payload: any = { action: "logs", limit: 100 };
      if (logFilter.template !== "all") payload.templateName = logFilter.template;
      if (logFilter.status !== "all") payload.status = logFilter.status;
      if (logFilter.search.trim()) payload.search = logFilter.search.trim();
      const d = await callTool(payload);
      setLogs(d.logs);
    } catch (e: any) {
      toast.error(`Falha ao carregar logs: ${e.message}`);
    } finally { setLogsLoading(false); }
  };

  const stats = useMemo(() => {
    const counts: Record<string, number> = { sent: 0, pending: 0, failed: 0, dlq: 0, suppressed: 0 };
    logs.forEach((l) => { counts[l.status] = (counts[l.status] ?? 0) + 1; });
    return counts;
  }, [logs]);

  // --- Diagnóstico / operações de fila ---
  const [domainCfg, setDomainCfg] = useState<any>(null);
  const [queueStats, setQueueStats] = useState<any>(null);
  const [testEmail, setTestEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const loadDiagnostics = async () => {
    try {
      const [cfg, qs] = await Promise.all([
        callTool({ action: "domain-config" }),
        callTool({ action: "queue-stats" }),
      ]);
      setDomainCfg(cfg);
      setQueueStats(qs.stats);
    } catch (e: any) {
      toast.error(`Falha ao carregar diagnóstico: ${e.message}`);
    }
  };

  useEffect(() => { loadDiagnostics(); }, []);

  const sendTest = async () => {
    if (!testEmail.trim()) return toast.error("Informe um e-mail de destino.");
    setBusy("test");
    try {
      await callTool({ action: "send-test", recipientEmail: testEmail.trim() });
      toast.success(`E-mail de teste enviado para ${testEmail.trim()}.`);
      await Promise.all([loadDiagnostics(), loadLogs()]);
    } catch (e: any) {
      toast.error(`Falha no envio de teste: ${e.message}`);
    } finally { setBusy(null); }
  };

  const reprocessQueue = async () => {
    setBusy("process");
    try {
      const d = await callTool({ action: "process-queue" });
      toast.success(`Fila reprocessada (${d.result?.processed ?? 0} enviado(s)).`);
      await Promise.all([loadDiagnostics(), loadLogs()]);
    } catch (e: any) {
      toast.error(`Falha ao reprocessar: ${e.message}`);
    } finally { setBusy(null); }
  };

  const requeueDlq = async () => {
    setBusy("requeue");
    try {
      const d = await callTool({ action: "requeue-dlq", limit: 500 });
      const total = Object.values(d.requeued ?? {}).reduce((a: number, b: any) => a + Number(b), 0);
      toast.success(`${total} e-mail(s) reenfileirado(s) com o remetente corrigido.`);
      await Promise.all([loadDiagnostics(), loadLogs()]);
    } catch (e: any) {
      toast.error(`Falha ao reenviar falhas: ${e.message}`);
    } finally { setBusy(null); }
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="border-b bg-card sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" />Admin</Link></Button>
          <Link to="/admin" aria-label="Voltar ao painel">
            <img src={logo} alt="Spencer's Cardtopia" className="h-8 w-auto" />
          </Link>
          <h1 className="font-display text-xl">E-mails transacionais</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="preview">
          <TabsList>
            <TabsTrigger value="preview"><Mail className="h-4 w-4 mr-1" /> Preview de templates</TabsTrigger>
            <TabsTrigger value="logs"><ScrollText className="h-4 w-4 mr-1" /> Logs de envio</TabsTrigger>
            <TabsTrigger value="diagnostico"><Send className="h-4 w-4 mr-1" /> Diagnóstico e fila</TabsTrigger>
          </TabsList>

          <TabsContent value="diagnostico" className="mt-4 space-y-4">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg">Configuração do remetente</h2>
                <Button variant="outline" size="sm" onClick={loadDiagnostics}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
                </Button>
              </div>
              {domainCfg ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {domainCfg.valid ? (
                      <Badge className="bg-green-500/20 text-green-700 dark:text-green-300">Válido</Badge>
                    ) : (
                      <Badge className="bg-red-600/30 text-red-800 dark:text-red-200">Inválido</Badge>
                    )}
                    <span className="text-muted-foreground">Envios são bloqueados quando inválido.</span>
                  </div>
                  <div className="font-mono text-xs space-y-1">
                    <div><span className="text-muted-foreground">From: </span>{domainCfg.fromAddress}</div>
                    <div><span className="text-muted-foreground">sender_domain: </span>{domainCfg.senderDomain}</div>
                  </div>
                  {!domainCfg.valid && (
                    <ul className="list-disc pl-5 text-red-600 text-xs">
                      {domainCfg.errors?.map((e: string, i: number) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              ) : <p className="text-sm text-muted-foreground">Carregando…</p>}
            </Card>

            <Card className="p-4 space-y-3">
              <h2 className="font-display text-lg">Enviar e-mail de teste</h2>
              <p className="text-sm text-muted-foreground">
                Usa o mesmo remetente e a mesma fila dos e-mails reais.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input type="email" placeholder="seu@email.com" value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)} />
                <Button onClick={sendTest} disabled={busy !== null}>
                  {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Enviar teste
                </Button>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h2 className="font-display text-lg">Fila de envio</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  ["Pendentes (transacionais)", queueStats?.transactional_pending],
                  ["Falhas (transacionais)", queueStats?.transactional_dlq],
                  ["Pendentes (autenticação)", queueStats?.auth_pending],
                  ["Falhas (autenticação)", queueStats?.auth_dlq],
                ].map(([label, v]) => (
                  <Card key={String(label)} className="p-3 text-center">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-2xl font-display">{v ?? "—"}</div>
                  </Card>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={reprocessQueue} disabled={busy !== null} variant="outline">
                  {busy === "process" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Reprocessar fila agora
                </Button>
                <Button onClick={requeueDlq} disabled={busy !== null}>
                  {busy === "requeue" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <AlertTriangle className="h-4 w-4 mr-1" />}
                  Reenviar e-mails que falharam
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O reenvio reescreve o remetente das mensagens antigas com a configuração atual antes de recolocá-las na fila.
              </p>
            </Card>
          </TabsContent>


          <TabsContent value="preview" className="mt-4">
            <div className="grid md:grid-cols-[320px_1fr] gap-4">
              <Card className="p-4 space-y-4">
                <div>
                  <Label>Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => <SelectItem key={t.name} value={t.name}>{t.displayName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pedido real (opcional)</Label>
                  <Select value={selectedOrder || "preview"} onValueChange={(v) => setSelectedOrder(v === "preview" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preview">Dados de exemplo</SelectItem>
                      {orders.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          #{o.id.slice(0, 8)} · R$ {Number(o.total).toFixed(2)} · {o.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={renderTemplate} disabled={renderLoading} className="w-full">
                  {renderLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />} Re-renderizar
                </Button>
                <div>
                  <Label className="text-xs text-muted-foreground">Dados injetados</Label>
                  <Textarea value={renderData} readOnly rows={12} className="font-mono text-xs" />
                </div>
              </Card>
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/30 text-sm">
                  <span className="text-muted-foreground">Assunto: </span><strong>{renderSubject || "—"}</strong>
                </div>
                <iframe title="preview" srcDoc={renderHtml} className="w-full h-[700px] bg-white" />
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {(["sent", "pending", "failed", "dlq", "suppressed"] as const).map((s) => (
                <Card key={s} className="p-3 text-center">
                  <div className="text-xs uppercase text-muted-foreground">{s}</div>
                  <div className="text-2xl font-display">{stats[s] ?? 0}</div>
                </Card>
              ))}
            </div>
            <Card className="p-4 grid md:grid-cols-4 gap-3">
              <div>
                <Label>Template</Label>
                <Select value={logFilter.template} onValueChange={(v) => setLogFilter({ ...logFilter, template: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {templates.map((t) => <SelectItem key={t.name} value={t.name}>{t.displayName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={logFilter.status} onValueChange={(v) => setLogFilter({ ...logFilter, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {["sent", "pending", "failed", "dlq", "suppressed", "bounced", "complained"].map((s) =>
                      <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Buscar (email ou ID)</Label>
                <div className="flex gap-2">
                  <Input value={logFilter.search} onChange={(e) => setLogFilter({ ...logFilter, search: e.target.value })}
                    placeholder="cliente@dominio.com ou order-..." />
                  <Button onClick={loadLogs} disabled={logsLoading}>
                    {logsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Filtrar"}
                  </Button>
                </div>
              </div>
            </Card>
            <Card className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Quando</th>
                    <th className="text-left px-3 py-2">Template</th>
                    <th className="text-left px-3 py-2">Destinatário</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Tentativas</th>
                    <th className="text-left px-3 py-2">Mensagem / ID</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && !logsLoading && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum log encontrado.</td></tr>
                  )}
                  {logs.map((l) => {
                    const id = l.message_id ?? l.id;
                    const isOpen = expanded === id;
                    return (
                      <>
                        <tr key={id} className="border-t hover:bg-muted/30 cursor-pointer"
                            onClick={() => setExpanded(isOpen ? null : id)}>
                          <td className="px-3 py-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                          <td className="px-3 py-2">{l.template_name}</td>
                          <td className="px-3 py-2">{l.recipient_email}</td>
                          <td className="px-3 py-2"><Badge className={statusColor[l.status] ?? ""}>{l.status}</Badge></td>
                          <td className="px-3 py-2">{l.attempts}</td>
                          <td className="px-3 py-2 max-w-md truncate">
                            {l.error_message ?? <span className="text-muted-foreground font-mono text-xs">{id}</span>}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={id + "-detail"} className="bg-muted/20">
                            <td colSpan={6} className="px-3 py-3">
                              <div className="text-xs font-mono">
                                <div className="mb-2"><strong>Message ID:</strong> {id}</div>
                                <div className="mb-2"><strong>Histórico ({l.history.length})</strong></div>
                                <ol className="space-y-1">
                                  {l.history.map((h, i) => (
                                    <li key={i} className="border-l-2 border-border pl-2">
                                      <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                                      {" · "}<Badge className={statusColor[h.status] ?? ""}>{h.status}</Badge>
                                      {h.error_message && <div className="text-red-600 mt-1">{h.error_message}</div>}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminEmails;
