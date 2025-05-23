import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CalendarHelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const CalendarHelpDialog: React.FC<CalendarHelpDialogProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">Como usar o calendário interativo</DialogTitle>
          <DialogDescription>
            Guia completo para a funcionalidade de arrastar e marcar horários
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="pr-6 mt-2 max-h-[60vh]">
          <div className="space-y-4">
            <section>
              <h3 className="font-semibold text-lg">Funcionalidade de Arrastar e Marcar Horário</h3>
              <p className="text-sm text-muted-foreground mt-1">
                A função de "arrastar para marcar" permite selecionar visualmente um intervalo 
                de tempo diretamente no calendário para criar agendamentos de forma intuitiva.
              </p>
            </section>
            
            <section>
              <h3 className="font-semibold">Como usar:</h3>
              <ol className="list-decimal list-inside space-y-2 mt-2 text-sm">
                <li>
                  <span className="font-medium">Na visualização de dia ou semana:</span>
                  <ul className="list-disc list-inside ml-6 mt-1 text-muted-foreground">
                    <li>Clique no horário de início desejado</li>
                    <li>Arraste até o horário de término</li>
                    <li>Solte o mouse para abrir o formulário de agendamento</li>
                  </ul>
                </li>
                <li>
                  <span className="font-medium">Para agendamentos rápidos:</span>
                  <ul className="list-disc list-inside ml-6 mt-1 text-muted-foreground">
                    <li>Use clique duplo em um slot específico para criar um agendamento com duração padrão (30 min)</li>
                  </ul>
                </li>
                <li>
                  <span className="font-medium">Para ajustar agendamentos existentes:</span>
                  <ul className="list-disc list-inside ml-6 mt-1 text-muted-foreground">
                    <li>Clique e arraste um agendamento para movê-lo</li>
                    <li>Arraste a borda inferior para ajustar apenas o horário de término</li>
                  </ul>
                </li>
              </ol>
            </section>
            
            <section>
              <h3 className="font-semibold">Feedback visual:</h3>
              <ul className="list-disc list-inside space-y-1 mt-2 text-sm text-muted-foreground">
                <li>Os slots sendo selecionados mudam de cor</li>
                <li>Uma borda destaca a área selecionada</li>
                <li>Slots já ocupados têm uma aparência diferente</li>
                <li>Horários fora do expediente são mais escuros ou bloqueados</li>
              </ul>
            </section>
            
            <section>
              <h3 className="font-semibold">Validações automáticas:</h3>
              <ul className="list-disc list-inside space-y-1 mt-2 text-sm text-muted-foreground">
                <li>Ao selecionar um horário já ocupado, o sistema mostra um aviso</li>
                <li>Não é possível selecionar datas passadas</li>
                <li>Verificação de sobreposição com outros agendamentos</li>
              </ul>
            </section>
            
            <section>
              <h3 className="font-semibold">Dicas adicionais:</h3>
              <ul className="list-disc list-inside space-y-1 mt-2 text-sm text-muted-foreground">
                <li>Use a barra de filtros para visualizar apenas determinados profissionais</li>
                <li>Alterne entre as visualizações de dia, semana e mês conforme necessidade</li>
                <li>O código de cores ajuda a identificar o status dos agendamentos</li>
              </ul>
            </section>
          </div>
        </ScrollArea>
        
        <DialogFooter>
          <Button onClick={onClose}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CalendarHelpDialog;