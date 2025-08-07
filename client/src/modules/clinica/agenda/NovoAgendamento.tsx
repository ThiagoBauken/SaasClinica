import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function NovoAgendamento() {
  const [, setLocation] = useLocation();

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/agenda")}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold">Novo Agendamento</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Criar Novo Agendamento</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Interface de criação de agendamento em desenvolvimento...</p>
        </CardContent>
      </Card>
    </div>
  );
}