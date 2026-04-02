import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Printer, 
  Plus, 
  Trash2, 
  FileSignature, 
  Pill, 
  Clipboard, 
  Loader2 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DocumentsTabProps {
  patientId: number;
}

export default function DocumentsTab({ patientId }: DocumentsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [docType, setDocType] = useState<"prescription" | "certificate" | "consent">("prescription");

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    documentType: "prescription",
  });

  const { data: prescriptions = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/prescriptions`],
    enabled: !!patientId,
  });

  const createDocMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        patientId,
        issueDate: new Date().toISOString().split('T')[0],
      };
      const res = await apiRequest("POST", `/api/patients/${patientId}/prescriptions`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/prescriptions`] });
      toast({ title: "Documento salvo", description: "O documento foi gerado com sucesso." });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      documentType: docType,
    });
  };

  const openNewDocDialog = (type: "prescription" | "certificate" | "consent") => {
    setDocType(type);
    
    // Autopreenchimento simples
    let defaultTitle = "";
    let defaultContent = "";

    if (type === "prescription") {
      defaultTitle = "Receituário Padrão";
      defaultContent = "Uso Oral:\n\n1. Amoxicilina 500mg ------ 1 cx\nTomar 1 comp de 8/8h por 7 dias\n\n2. Ibuprofeno 600mg ------ 1 cx\nTomar 1 comp de 12/12h em caso de dor";
    } else if (type === "certificate") {
      defaultTitle = "Atestado Odontológico";
      defaultContent = "Atesto para os devidos fins que o paciente foi submetido a tratamento odontológico nesta data, necessitando de 1 (um) dia de repouso.";
    } else if (type === "consent") {
      defaultTitle = "Termo de Consentimento Livre e Esclarecido";
      defaultContent = "Declaro ter sido devidamente informado(a) pelo(a) cirurgião(ã)-dentista sobre os propósitos, riscos e alternativas do tratamento proposto, concordando com a sua realização.";
    }

    setFormData({
      title: defaultTitle,
      content: defaultContent,
      documentType: type,
    });
    
    setIsDialogOpen(true);
  };

  const handlePrint = (doc: any) => {
    // Basic logic to print document directly from browser
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${doc.title}</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; line-height: 1.6; color: #333; }
              .header { text-align: center; border-bottom: 2px solid #ccc; padding-bottom: 20px; margin-bottom: 30px; }
              .clinic-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
              .title { font-size: 18px; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; text-align: center; }
              .content { white-space: pre-wrap; margin-bottom: 50px; font-size: 16px; }
              .footer { margin-top: 80px; text-align: center; }
              .signature { border-top: 1px solid #333; width: 300px; margin: 0 auto; padding-top: 10px; }
              .date { margin-bottom: 40px; text-align: right; }
              @media print {
                body { padding: 0; }
                button { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="clinic-name">Clinica Odontológica</div>
              <div>Receituário / Prontuário Médico</div>
            </div>
            
            <div class="title">${doc.title}</div>
            
            <div class="date">Data: ${new Date(doc.createdAt || Date.now()).toLocaleDateString('pt-BR')}</div>
            
            <div class="content">${doc.content}</div>
            
            <div class="footer">
              <div class="signature">Assinatura do Profissional</div>
            </div>
            
            <script>
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Documentos e Receitas</CardTitle>
          <CardDescription>
            Gerencie e imprima receitas, atestados e termos de consentimento.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openNewDocDialog("certificate")}>
            <Clipboard className="h-4 w-4 mr-2" />
            Atestado
          </Button>
          <Button onClick={() => openNewDocDialog("prescription")}>
            <Pill className="h-4 w-4 mr-2" />
            Receita
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {prescriptions.length === 0 ? (
          <div className="text-center py-8">
            <FileSignature className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Nenhum documento emitido para este paciente.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {prescriptions.map((doc: any) => (
              <div key={doc.id} className="border rounded-lg p-5 bg-card hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-base font-semibold">{doc.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={
                        doc.documentType === "prescription" ? "default" :
                        doc.documentType === "certificate" ? "secondary" : "outline"
                      }>
                        {doc.documentType === "prescription" ? "Receita" : 
                         doc.documentType === "certificate" ? "Atestado" : "Termo"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => handlePrint(doc)}>
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground mt-2 line-clamp-3 bg-muted/20 p-2 rounded">
                  {doc.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {docType === "prescription" ? "Nova Receita" : 
               docType === "certificate" ? "Novo Atestado" : "Novo Documento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título / Referência</Label>
              <Input 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Conteúdo do Documento</Label>
              <Textarea 
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                placeholder="Escreva os detalhes do documento..."
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => createDocMutation.mutate(formData)} 
              disabled={createDocMutation.isPending}
            >
              {createDocMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar e Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
