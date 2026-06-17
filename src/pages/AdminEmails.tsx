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
import { ArrowLeft, Loader2, RefreshCw, Mail, ScrollText } from "lucide-react";
import { toast } from "sonner";
import useSEO from "@/hooks/use-seo";

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

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="border-b bg-card sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild><Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" />Admin</Link></Button>
          <h1 className="font-display text-xl">E-mails transacionais</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="preview">
          <TabsList>
            <TabsTrigger value="preview"><Mail className="h-4 w-4 mr-1" /> Preview de templates</TabsTrigger>
            <TabsTrigger value="logs"><ScrollText className="h-4 w-4 mr-1" /> Logs de envio</TabsTrigger>
          </TabsList>

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
