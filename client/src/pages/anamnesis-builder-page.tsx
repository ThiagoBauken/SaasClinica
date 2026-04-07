import { useState, useId } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getCsrfHeaders } from '@/lib/csrf';
import {
  Plus,
  GripVertical,
  Trash2,
  Eye,
  EyeOff,
  Save,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export type FieldType =
  | 'text'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'number'
  | 'date'
  | 'scale';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  section?: string;
  scaleMin?: number;
  scaleMax?: number;
}

interface AnamnesisTemplate {
  id: number;
  name: string;
  fields: FormField[];
}

// ---------------------------------------------------------------
// Default dental anamnesis template
// ---------------------------------------------------------------

function buildDefaultFields(): FormField[] {
  const sections: { section: string; fields: Omit<FormField, 'id'>[] }[] = [
    {
      section: 'Queixa Principal',
      fields: [
        { type: 'textarea', label: 'Qual o motivo da consulta?', required: true },
        { type: 'text', label: 'Ha quanto tempo tem esse problema?', required: false },
      ],
    },
    {
      section: 'Historico Medico',
      fields: [
        { type: 'checkbox', label: 'Doenca cardiaca', required: false },
        { type: 'checkbox', label: 'Hipertensao arterial', required: false },
        { type: 'checkbox', label: 'Diabetes mellitus', required: false },
        { type: 'checkbox', label: 'Hepatite ou doenca hepatica', required: false },
        { type: 'checkbox', label: 'Uso de anticoagulante', required: false },
        { type: 'checkbox', label: 'Alergia a medicamentos', required: false },
        { type: 'checkbox', label: 'Gestante ou lactante', required: false },
        { type: 'textarea', label: 'Medicamentos em uso (nome e dosagem)', required: false, placeholder: 'Ex: Losartana 50mg, 1x ao dia' },
        { type: 'textarea', label: 'Cirurgias ou internacoes anteriores', required: false },
      ],
    },
    {
      section: 'Habitos',
      fields: [
        { type: 'checkbox', label: 'Fumante', required: false },
        { type: 'checkbox', label: 'Consome bebida alcoolica regularmente', required: false },
        { type: 'checkbox', label: 'Bruxismo (range ou aperta os dentes)', required: false },
        { type: 'checkbox', label: 'Ronco ou apneia do sono', required: false },
      ],
    },
    {
      section: 'Saude Bucal',
      fields: [
        { type: 'radio', label: 'Frequencia de escovacao', required: false, options: ['1x ao dia', '2x ao dia', '3x ou mais ao dia'] },
        { type: 'checkbox', label: 'Usa fio dental regularmente', required: false },
        { type: 'checkbox', label: 'Sangramentos gengivais', required: false },
        { type: 'checkbox', label: 'Sensibilidade dental', required: false },
      ],
    },
    {
      section: 'Ansiedade Odontologica',
      fields: [
        { type: 'scale', label: 'Nivel de ansiedade em relacao ao dentista (0 = nenhuma, 10 = extrema)', required: false, scaleMin: 0, scaleMax: 10 },
      ],
    },
  ];

  return sections.flatMap((s) =>
    s.fields.map((f, i) => ({
      ...f,
      id: `default_${s.section}_${i}_${Date.now()}`,
      section: s.section,
    })),
  );
}

// ---------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------

export default function AnamnesisBuilderPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fields, setFields] = useState<FormField[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  // Fetch existing templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery<AnamnesisTemplate[]>({
    queryKey: ['/api/v1/settings/anamnesis-templates'],
    queryFn: async () => {
      const res = await fetch('/api/v1/settings/anamnesis-templates', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Save / create template
  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; fields: FormField[] }) => {
      const url = selectedTemplateId
        ? `/api/v1/settings/anamnesis-templates/${selectedTemplateId}`
        : '/api/v1/settings/anamnesis-templates';
      const method = selectedTemplateId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: getCsrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Falha ao salvar template');
      return res.json();
    },
    onSuccess: (saved: AnamnesisTemplate) => {
      toast({ title: 'Template salvo com sucesso!' });
      setSelectedTemplateId(saved.id);
      queryClient.invalidateQueries({ queryKey: ['/api/v1/settings/anamnesis-templates'] });
    },
    onError: () => {
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' });
    },
  });

  // ---------------------------------------------------------------
  // Field management
  // ---------------------------------------------------------------

  const addField = (field: Omit<FormField, 'id'>) => {
    setFields((prev) => [...prev, { ...field, id: `field_${Date.now()}_${Math.random().toString(36).slice(2)}` }]);
    setAddDialogOpen(false);
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
  };

  const loadDefaults = () => {
    setFields(buildDefaultFields());
    setTemplateName('Anamnese Padrao Odontologica');
    setSelectedTemplateId(null);
  };

  const loadTemplate = (id: string) => {
    const tpl = templates.find((t) => t.id === Number(id));
    if (!tpl) return;
    setFields(tpl.fields);
    setTemplateName(tpl.name);
    setSelectedTemplateId(tpl.id);
  };

  const handleSave = () => {
    if (!templateName.trim()) {
      toast({ title: 'Informe o nome do template', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({ name: templateName.trim(), fields });
  };

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="h-6 w-6" />
              Construtor de Anamnese
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure os campos do formulario de anamnese da sua clinica
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={loadDefaults}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Carregar Padrao
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview((v) => !v)}
              aria-pressed={showPreview}
            >
              {showPreview ? (
                <><EyeOff className="h-4 w-4 mr-2" /> Editar</>
              ) : (
                <><Eye className="h-4 w-4 mr-2" /> Preview</>
              )}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Template
            </Button>
          </div>
        </div>

        {/* Template name + existing templates loader */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="space-y-1">
            <Label htmlFor="template-name">Nome do Template</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Ex: Anamnese Ortodontia, Anamnese Pediatrica"
            />
          </div>
          {templates.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="load-template">Carregar Template Existente</Label>
              <Select onValueChange={loadTemplate}>
                <SelectTrigger id="load-template">
                  <SelectValue placeholder={isLoadingTemplates ? 'Carregando...' : 'Selecione um template'} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Separator className="mb-6" />

        {showPreview ? (
          <FormPreview fields={fields} templateName={templateName} />
        ) : (
          <FieldEditor
            fields={fields}
            onMove={moveField}
            onRemove={removeField}
            addDialogOpen={addDialogOpen}
            onAddDialogChange={setAddDialogOpen}
            onAddField={addField}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------
// Field Editor
// ---------------------------------------------------------------

interface FieldEditorProps {
  fields: FormField[];
  onMove: (index: number, direction: 'up' | 'down') => void;
  onRemove: (id: string) => void;
  addDialogOpen: boolean;
  onAddDialogChange: (open: boolean) => void;
  onAddField: (field: Omit<FormField, 'id'>) => void;
}

function FieldEditor({
  fields,
  onMove,
  onRemove,
  addDialogOpen,
  onAddDialogChange,
  onAddField,
}: FieldEditorProps) {
  const FIELD_TYPE_LABELS: Record<FieldType, string> = {
    text: 'Texto curto',
    textarea: 'Texto longo',
    checkbox: 'Checkbox',
    radio: 'Radio',
    select: 'Dropdown',
    number: 'Numero',
    date: 'Data',
    scale: 'Escala',
  };

  return (
    <div className="space-y-2">
      {fields.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum campo adicionado</p>
          <p className="text-sm mt-1">Clique em &quot;Adicionar Campo&quot; ou &quot;Carregar Padrao&quot;</p>
        </div>
      )}

      {fields.map((field, index) => (
        <Card key={field.id} className="border">
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <GripVertical
              className="h-4 w-4 text-muted-foreground shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <span className="font-medium text-sm truncate block">{field.label}</span>
              <div className="flex flex-wrap gap-1 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {FIELD_TYPE_LABELS[field.type]}
                </Badge>
                {field.required && (
                  <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                    Obrigatorio
                  </Badge>
                )}
                {field.section && (
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                    {field.section}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onMove(index, 'up')}
                disabled={index === 0}
                aria-label="Mover campo para cima"
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onMove(index, 'down')}
                disabled={index === fields.length - 1}
                aria-label="Mover campo para baixo"
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onRemove(field.id)}
                aria-label={`Remover campo ${field.label}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={addDialogOpen} onOpenChange={onAddDialogChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full border-dashed mt-2"
            aria-label="Adicionar novo campo ao formulario"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Campo
          </Button>
        </DialogTrigger>
        <DialogContent aria-describedby="add-field-description">
          <DialogHeader>
            <DialogTitle>Novo Campo</DialogTitle>
            <p id="add-field-description" className="text-sm text-muted-foreground">
              Configure o tipo e as propriedades do novo campo
            </p>
          </DialogHeader>
          <AddFieldForm onAdd={onAddField} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------
// Add Field Form
// ---------------------------------------------------------------

interface AddFieldFormProps {
  onAdd: (field: Omit<FormField, 'id'>) => void;
}

function AddFieldForm({ onAdd }: AddFieldFormProps) {
  const labelId = useId();
  const [type, setType] = useState<FieldType>('text');
  const [label, setLabel] = useState('');
  const [required, setRequired] = useState(false);
  const [section, setSection] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [optionsRaw, setOptionsRaw] = useState('');
  const [scaleMax, setScaleMax] = useState(10);

  const hasOptions = type === 'radio' || type === 'select';

  const handleSubmit = () => {
    if (!label.trim()) return;
    onAdd({
      type,
      label: label.trim(),
      required,
      section: section.trim() || undefined,
      placeholder: placeholder.trim() || undefined,
      options: hasOptions
        ? optionsRaw.split('\n').map((o) => o.trim()).filter(Boolean)
        : undefined,
      scaleMin: type === 'scale' ? 0 : undefined,
      scaleMax: type === 'scale' ? scaleMax : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="field-type">Tipo de Campo</Label>
        <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
          <SelectTrigger id="field-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Texto curto</SelectItem>
            <SelectItem value="textarea">Texto longo</SelectItem>
            <SelectItem value="checkbox">Checkbox (Sim/Nao)</SelectItem>
            <SelectItem value="radio">Radio (escolha unica)</SelectItem>
            <SelectItem value="select">Dropdown</SelectItem>
            <SelectItem value="number">Numero</SelectItem>
            <SelectItem value="date">Data</SelectItem>
            <SelectItem value="scale">Escala (0-10)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor={labelId}>Pergunta / Label</Label>
        <Input
          id={labelId}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Voce tem alergia a algum medicamento?"
        />
      </div>

      {(type === 'text' || type === 'textarea') && (
        <div className="space-y-1">
          <Label htmlFor="field-placeholder">Placeholder (opcional)</Label>
          <Input
            id="field-placeholder"
            value={placeholder}
            onChange={(e) => setPlaceholder(e.target.value)}
            placeholder="Texto de exemplo para o campo"
          />
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="field-section">Secao (opcional)</Label>
        <Input
          id="field-section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          placeholder="Ex: Historico Medico, Habitos"
        />
      </div>

      {hasOptions && (
        <div className="space-y-1">
          <Label htmlFor="field-options">Opcoes (uma por linha)</Label>
          <Textarea
            id="field-options"
            rows={4}
            value={optionsRaw}
            onChange={(e) => setOptionsRaw(e.target.value)}
            placeholder={'Opcao 1\nOpcao 2\nOpcao 3'}
          />
        </div>
      )}

      {type === 'scale' && (
        <div className="space-y-1">
          <Label htmlFor="field-scale-max">Valor maximo da escala</Label>
          <Input
            id="field-scale-max"
            type="number"
            min={2}
            max={20}
            value={scaleMax}
            onChange={(e) => setScaleMax(Number(e.target.value))}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          id="field-required"
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <Label htmlFor="field-required">Campo obrigatorio</Label>
      </div>

      <Button onClick={handleSubmit} disabled={!label.trim()} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Campo
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------
// Form Preview
// ---------------------------------------------------------------

interface FormPreviewProps {
  fields: FormField[];
  templateName: string;
}

function FormPreview({ fields, templateName }: FormPreviewProps) {
  // Group fields by section for a cleaner preview
  const sections = fields.reduce<Record<string, FormField[]>>((acc, field) => {
    const key = field.section || 'Geral';
    if (!acc[key]) acc[key] = [];
    acc[key].push(field);
    return acc;
  }, {});

  if (fields.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum campo para visualizar. Adicione campos no modo de edicao.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{templateName || 'Preview do Formulario'}</CardTitle>
        <CardDescription>Como o paciente vera este formulario</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(sections).map(([sectionName, sectionFields]) => (
          <div key={sectionName}>
            {sectionName !== 'Geral' && (
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                {sectionName}
              </h3>
            )}
            <div className="space-y-4">
              {sectionFields.map((field) => (
                <PreviewField key={field.id} field={field} />
              ))}
            </div>
            <Separator className="mt-4" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PreviewField({ field }: { field: FormField }) {
  return (
    <div className="space-y-1">
      {field.type !== 'checkbox' && (
        <Label>
          {field.label}
          {field.required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
        </Label>
      )}
      {field.type === 'text' && (
        <Input placeholder={field.placeholder || ''} disabled />
      )}
      {field.type === 'textarea' && (
        <Textarea placeholder={field.placeholder || ''} rows={2} disabled />
      )}
      {field.type === 'checkbox' && (
        <div className="flex items-center gap-2">
          <input type="checkbox" disabled className="h-4 w-4" id={`prev-${field.id}`} />
          <label htmlFor={`prev-${field.id}`} className="text-sm">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
        </div>
      )}
      {field.type === 'number' && <Input type="number" disabled />}
      {field.type === 'date' && <Input type="date" disabled />}
      {field.type === 'scale' && (
        <div className="flex flex-wrap gap-1 mt-1" role="group" aria-label={field.label}>
          {Array.from({ length: (field.scaleMax ?? 10) + 1 }, (_, i) => (
            <button
              key={i}
              type="button"
              disabled
              className="w-9 h-9 border rounded text-xs font-medium disabled:opacity-60"
            >
              {i}
            </button>
          ))}
        </div>
      )}
      {(field.type === 'radio' || field.type === 'select') &&
        field.options?.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type={field.type === 'radio' ? 'radio' : 'checkbox'}
              disabled
              className="h-4 w-4"
            />
            <span className="text-sm">{opt}</span>
          </div>
        ))}
      {(field.type === 'radio' || field.type === 'select') && !field.options?.length && (
        <p className="text-xs text-muted-foreground italic">Nenhuma opcao definida</p>
      )}
    </div>
  );
}
