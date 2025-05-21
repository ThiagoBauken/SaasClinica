import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Mail, Calendar, ChevronRight } from "lucide-react";

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
            <TableHead className="w-1/3">Nome</TableHead>
            <TableHead className="w-1/5">Contato</TableHead>
            <TableHead className="w-1/5">Idade</TableHead>
            <TableHead className="w-1/5">Cadastrado</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                Nenhum paciente encontrado
              </TableCell>
            </TableRow>
          ) : (
            patients.map((patient) => (
              <TableRow key={patient.id}>
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
                  <div className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(patient.createdAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-1.5"
                    onClick={() => onPatientClick(patient)}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
