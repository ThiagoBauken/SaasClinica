import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Plus, Send, Users, Hash, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import DashboardLayout from "@/layouts/DashboardLayout";

interface Channel {
  id: number;
  name: string;
  description?: string;
  unread_count: number;
  last_message?: string;
  last_message_at?: string;
}

interface Message {
  id: number;
  content: string;
  sender_name: string;
  sender_id: number;
  created_at: string;
}

export default function OfficeChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: channels = [], isLoading: loadingChannels } = useQuery<Channel[]>({
    queryKey: ["/api/v1/office-chat/channels"],
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/v1/office-chat/channels", selectedChannel, "messages"],
    enabled: !!selectedChannel,
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await apiRequest("POST", "/api/v1/office-chat/channels", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/office-chat/channels"] });
      toast({ title: "Canal criado!" });
      setIsDialogOpen(false);
      setNewChannelName("");
      setNewChannelDesc("");
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { channelId: number; content: string }) => {
      const res = await apiRequest("POST", `/api/v1/office-chat/channels/${data.channelId}/messages`, { content: data.content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/office-chat/channels", selectedChannel, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/office-chat/channels"] });
      setMessageText("");
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-refresh messages every 5s
  useEffect(() => {
    if (!selectedChannel) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/office-chat/channels", selectedChannel, "messages"] });
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedChannel]);

  const handleSend = () => {
    if (!messageText.trim() || !selectedChannel) return;
    sendMessageMutation.mutate({ channelId: selectedChannel, content: messageText.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const channelList = Array.isArray(channels) ? channels : [];
  const messageList = Array.isArray(messages) ? messages : [];

  return (
    <DashboardLayout title="Chat Interno" currentPath="/chat-interno">
      <div className="flex h-[calc(100vh-180px)] gap-4">
        {/* Sidebar - Channels */}
        <div className="w-72 flex-shrink-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> Canais
                </CardTitle>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon"><Plus className="h-4 w-4" /></Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Novo Canal</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label>Nome do canal</Label>
                        <Input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} placeholder="Ex: geral, recepcao, dentistas" />
                      </div>
                      <div>
                        <Label>Descricao (opcional)</Label>
                        <Input value={newChannelDesc} onChange={(e) => setNewChannelDesc(e.target.value)} placeholder="Para que serve este canal" />
                      </div>
                      <Button onClick={() => createChannelMutation.mutate({ name: newChannelName, description: newChannelDesc })} disabled={!newChannelName.trim() || createChannelMutation.isPending} className="w-full">
                        Criar Canal
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1">
              <div className="space-y-1 px-3 pb-3">
                {loadingChannels ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : channelList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum canal. Crie o primeiro!</p>
                ) : channelList.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChannel(ch.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${selectedChannel === ch.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                  >
                    <Hash className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 truncate">{ch.name}</span>
                    {ch.unread_count > 0 && (
                      <Badge variant="default" className="text-xs px-1.5 py-0">{ch.unread_count}</Badge>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Main - Messages */}
        <Card className="flex-1 flex flex-col">
          {!selectedChannel ? (
            <CardContent className="flex flex-col items-center justify-center h-full">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Selecione um canal</p>
              <p className="text-muted-foreground">Escolha um canal na barra lateral para conversar</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  {channelList.find(c => c.id === selectedChannel)?.name || "Canal"}
                </CardTitle>
              </CardHeader>

              <ScrollArea className="flex-1 px-4 py-3">
                {loadingMessages ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : messageList.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">Nenhuma mensagem ainda. Diga ola!</p>
                ) : (
                  <div className="space-y-4">
                    {messageList.map((msg) => {
                      const isMe = msg.sender_id === user?.id;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[70%] rounded-lg px-4 py-2.5 ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            {!isMe && <p className="text-xs font-medium mb-1 opacity-70">{msg.sender_name}</p>}
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <p className={`text-xs mt-1 ${isMe ? "opacity-70" : "text-muted-foreground"}`}>
                              {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua mensagem..."
                    className="flex-1"
                  />
                  <Button onClick={handleSend} disabled={!messageText.trim() || sendMessageMutation.isPending} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
