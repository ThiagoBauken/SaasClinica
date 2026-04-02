import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, DoorOpen, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Room {
  id: number;
  name: string;
  type: "Geral" | "Cirurgia" | "Diagnóstico" | "Radiologia";
  equipment: string;
  active: boolean;
}

type RoomFormData = {
  name: string;
  type: Room["type"];
  equipment: string;
  active: boolean;
};

const ROOM_TYPES: Room["type"][] = ["Geral", "Cirurgia", "Diagnóstico", "Radiologia"];

const TYPE_COLORS: Record<Room["type"], string> = {
  Geral: "bg-blue-100 text-blue-700 border-blue-200",
  Cirurgia: "bg-red-100 text-red-700 border-red-200",
  Diagnóstico: "bg-purple-100 text-purple-700 border-purple-200",
  Radiologia: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const EMPTY_FORM: RoomFormData = {
  name: "",
  type: "Geral",
  equipment: "",
  active: true,
};

export default function ConfiguracoesSalasPage() {
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState<RoomFormData>(EMPTY_FORM);

  const { data: rooms = [], isLoading } = useQuery<Room[]>({
    queryKey: ["/api/v1/rooms"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/v1/rooms");
      if (!res.ok) throw new Error("Falha ao carregar salas");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Room> & { id?: number }) => {
      if (data.id) {
        const { id, ...body } = data;
        const res = await apiRequest("PATCH", `/api/v1/rooms/${id}`, body);
        if (!res.ok) throw new Error("Falha ao atualizar sala");
        return res.json();
      }
      const res = await apiRequest("POST", "/api/v1/rooms", data);
      if (!res.ok) throw new Error("Falha ao criar sala");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/rooms"] });
      setIsDialogOpen(false);
      setEditingRoom(null);
      setFormData(EMPTY_FORM);
      toast({
        title: "Sala salva",
        description: "As informações da sala foram salvas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await apiRequest("PATCH", `/api/v1/rooms/${id}`, { active });
      if (!res.ok) throw new Error("Falha ao atualizar status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/rooms"] });
      toast({ title: "Status da sala atualizado." });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/v1/rooms/${id}`);
      if (!res.ok) throw new Error("Falha ao remover sala");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/rooms"] });
      setDeleteTarget(null);
      toast({ title: "Sala removida com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro ao remover sala", variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingRoom(null);
    setFormData(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const openEditDialog = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name,
      type: room.type,
      equipment: room.equipment ?? "",
      active: room.active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Room> = {
      name: formData.name,
      type: formData.type,
      equipment: formData.equipment,
      active: formData.active,
    };
    if (editingRoom) {
      saveMutation.mutate({ ...payload, id: editingRoom.id });
    } else {
      saveMutation.mutate(payload);
    }
  };

  const equipmentList = (raw: string): string[] =>
    raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

  return (
    <DashboardLayout title="Salas e Consultórios" currentPath="/configuracoes/salas">
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DoorOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Salas e Consultórios</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie as salas e consultórios disponíveis na clínica.
              </p>
            </div>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Sala
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : rooms.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <DoorOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhuma sala cadastrada</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Adicione salas e consultórios para organizar os atendimentos.
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar primeira sala
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => {
              const items = equipmentList(room.equipment ?? "");
              return (
                <Card
                  key={room.id}
                  className={`transition-opacity ${!room.active ? "opacity-60" : ""}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{room.name}</CardTitle>
                        <span
                          className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            TYPE_COLORS[room.type] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {room.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {room.active ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {room.active ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    {items.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                          Equipamentos
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {items.map((item, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Nenhum equipamento listado.
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="pt-3 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={room.active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: room.id, active: checked })
                        }
                      />
                      <Label className="text-xs text-muted-foreground cursor-pointer">
                        {room.active ? "Ativar" : "Desativar"}
                      </Label>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(room)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteTarget(room)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRoom ? "Editar Sala" : "Nova Sala"}</DialogTitle>
            <DialogDescription>
              {editingRoom
                ? "Atualize as informações da sala abaixo."
                : "Preencha os dados para cadastrar uma nova sala."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="room-name">Nome da sala</Label>
                <Input
                  id="room-name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Consultório 01"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="room-type">Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, type: value as Room["type"] }))
                  }
                >
                  <SelectTrigger id="room-type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="room-equipment">
                  Equipamentos{" "}
                  <span className="text-muted-foreground text-xs">(separados por vírgula)</span>
                </Label>
                <Textarea
                  id="room-equipment"
                  value={formData.equipment}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, equipment: e.target.value }))
                  }
                  placeholder="Ex: Cadeira odontológica, Refletor, Sugador"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="room-active"
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, active: checked }))
                  }
                />
                <Label htmlFor="room-active">Sala ativa</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover sala</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a sala "{deleteTarget?.name}"? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
