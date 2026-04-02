import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Opportunity } from '@/types/crm';

const opportunitySchema = z.object({
    title: z.string().min(1, 'Título é obrigatório'),
    leadName: z.string().optional(),
    leadPhone: z.string().optional(),
    leadEmail: z.string().email('E-mail inválido').optional().or(z.literal('')),
    leadSource: z.string().optional(),
    treatmentType: z.string().optional(),
    estimatedValue: z.string().optional(),
    notes: z.string().optional(),
    stageId: z.number().optional(),
});

type OpportunityFormValues = z.infer<typeof opportunitySchema>;

interface OpportunityDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    opportunity?: Opportunity | null;
    onSubmit: (data: OpportunityFormValues) => void;
    isLoading?: boolean;
}

export function OpportunityDialog({
    open,
    onOpenChange,
    opportunity,
    onSubmit,
    isLoading,
}: OpportunityDialogProps) {
    const form = useForm<OpportunityFormValues>({
        resolver: zodResolver(opportunitySchema),
        defaultValues: {
            title: '',
            leadName: '',
            leadPhone: '',
            leadEmail: '',
            leadSource: '',
            treatmentType: '',
            estimatedValue: '',
            notes: '',
        },
    });

    useEffect(() => {
        if (opportunity) {
            form.reset({
                title: opportunity.title,
                leadName: opportunity.leadName || '',
                leadPhone: opportunity.leadPhone || '',
                leadEmail: opportunity.leadEmail || '',
                leadSource: opportunity.leadSource || '',
                treatmentType: opportunity.treatmentType || '',
                estimatedValue: opportunity.estimatedValue || '',
                notes: opportunity.notes || '',
                stageId: opportunity.stageId,
            });
        } else {
            form.reset({
                title: '',
                leadName: '',
                leadPhone: '',
                leadEmail: '',
                leadSource: '',
                treatmentType: '',
                estimatedValue: '',
                notes: '',
            });
        }
    }, [opportunity, form, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {opportunity ? 'Editar Oportunidade' : 'Nova Oportunidade'}
                    </DialogTitle>
                    <DialogDescription>
                        {opportunity
                            ? 'Edite os detalhes da oportunidade de venda.'
                            : 'Adicione um novo lead ou oportunidade de venda.'}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Título *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Implante - João Silva" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="leadName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nome do Lead</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Nome completo" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="leadPhone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Telefone</FormLabel>
                                        <FormControl>
                                            <Input placeholder="(00) 00000-0000" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="leadEmail"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>E-mail</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="email@exemplo.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="leadSource"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Origem</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                                <SelectItem value="instagram">Instagram</SelectItem>
                                                <SelectItem value="google">Google</SelectItem>
                                                <SelectItem value="indicacao">Indicação</SelectItem>
                                                <SelectItem value="site">Site</SelectItem>
                                                <SelectItem value="telefone">Telefone</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="treatmentType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de Tratamento</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="implante">Implante</SelectItem>
                                                <SelectItem value="ortodontia">Ortodontia</SelectItem>
                                                <SelectItem value="protese">Prótese</SelectItem>
                                                <SelectItem value="clareamento">Clareamento</SelectItem>
                                                <SelectItem value="limpeza">Limpeza</SelectItem>
                                                <SelectItem value="restauracao">Restauração</SelectItem>
                                                <SelectItem value="canal">Canal</SelectItem>
                                                <SelectItem value="harmonizacao">Harmonização</SelectItem>
                                                <SelectItem value="outros">Outros</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="estimatedValue"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Valor Estimado (R$)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="0,00" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Observações</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Anotações sobre o lead..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button type="submit" disabled={isLoading} className="w-full">
                            {opportunity ? 'Salvar Alterações' : 'Criar Oportunidade'}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
