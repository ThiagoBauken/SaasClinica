import { useState } from "react";
import { OdontogramProcedure } from "@/lib/types";
import Odontogram from "./Odontogram";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function OdontogramDemo() {
  const [procedures, setProcedures] = useState<OdontogramProcedure[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const handleSaveProcedures = (procedures: OdontogramProcedure[]) => {
    console.log("Procedures saved:", procedures);
    setProcedures(procedures);
  };
  
  return (
    <div className="p-4">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            onClick={() => setIsDialogOpen(true)}
            className="mb-4"
          >
            Abrir Odontograma
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Odontograma</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Odontogram 
              patientId={1} 
              onSave={handleSaveProcedures}
            />
          </div>
        </DialogContent>
      </Dialog>
      
      {procedures.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Procedimentos Salvos</h3>
          <pre className="bg-secondary/10 p-4 rounded-md overflow-auto">
            {JSON.stringify(procedures, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}