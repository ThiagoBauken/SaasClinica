import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, differenceInDays, differenceInMonths, differenceInYears, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Mail, Calendar, ChevronRight, Clock, FileText } from "lucide-react";
import { Link } from "wouter";

// Função para formatar o tempo desde a última consulta
function formatLastVisitTime(lastVisitDate: string | null | undefined): { text: string; color: string; needsAttention: boolean } {
  if (!lastVisitDate) {
    return { text: "Nunca consultou", color: "text-amber-500", needsAttention: true };
  }
  
  const today = new Date();
  const lastVisit = parseISO(lastVisitDate);
  
  const yearDiff = differenceInYears(today, lastVisit);
  const monthDiff = differenceInMonths(today, lastVisit);
  const dayDiff = differenceInDays(today, lastVisit);
  
  // Definir texto e cor com base no tempo desde a última consulta
  if (yearDiff >= 1) {
    return { 
      text: `${yearDiff} ${yearDiff === 1 ? 'ano' : 'anos'} atrás`,
      color: "text-red-500",
      needsAttention: true 
    };
  } else if (monthDiff >= 6) {
    return { 
      text: `${monthDiff} meses atrás`, 
      color: "text-red-500",
      needsAttention: true
    };
  } else if (monthDiff >= 3) {
    return { 
      text: `${monthDiff} meses atrás`, 
      color: "text-amber-500",
      needsAttention: true
    };
  } else if (monthDiff >= 1) {
    return { 
      text: `${monthDiff} ${monthDiff === 1 ? 'mês' : 'meses'} atrás`, 
      color: "text-neutral-600",
      needsAttention: false
    };
  } else if (dayDiff > 0) {
    return { 
      text: `${dayDiff} ${dayDiff === 1 ? 'dia' : 'dias'} atrás`, 
      color: "text-green-600",
      needsAttention: false
    };
  } else {
    return { 
      text: "Hoje", 
      color: "text-green-600",
      needsAttention: false
    };
  }
}

interface PatientsListProps {
  patients: any[];
  onPatientClick: (patient: any) => void;
}

export default function PatientsList({ patients, onPatientClick }: PatientsListProps) {
  return (
    <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/4">Nome</TableHead>
            <TableHead className="w-1/5">Contato</TableHead>
            <TableHead className="w-1/6">Idade</TableHead>
            <TableHead className="w-1/6">Última consulta</TableHead>
            <TableHead className="w-1/6">Cadastrado</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Nenhum paciente encontrado
              </TableCell>
            </TableRow>
          ) : (
            patients.map((patient, index) => (
              <TableRow key={`patient-${patient.id}-${index}`}>
                <TableCell>
                  <div 
                    className="font-medium cursor-pointer hover:text-primary hover:underline transition-colors"
                    onClick={() => onPatientClick(patient)}
                  >
                    {patient.fullName}
                  </div>
                  {patient.insuranceInfo && (
                    <div className="text-xs text-muted-foreground">
                      {patient.insuranceInfo}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center text-sm">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                      <span>{patient.phone || "—"}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                      <span className="truncate max-w-[150px]">
                        {patient.email || "—"}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                    {patient.birthDate ? (
                      <span>
                        {new Date().getFullYear() - new Date(patient.birthDate).getFullYear()} anos
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Não informada</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {patient.lastVisit ? (
                    <div className="flex items-center">
                      <Clock className={`h-4 w-4 mr-2 ${formatLastVisitTime(patient.lastVisit).needsAttention ? formatLastVisitTime(patient.lastVisit).color : "text-muted-foreground"}`} />
                      <div className={`text-sm ${formatLastVisitTime(patient.lastVisit).color}`}>
                        {formatLastVisitTime(patient.lastVisit).text}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-amber-500 mr-2" />
                      <div className="text-sm text-amber-500">
                        Nunca consultou
                      </div>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(patient.createdAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Link href={`/patients/${patient.id}/record`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3"
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Ficha
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-1.5"
                      onClick={() => onPatientClick(patient)}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
