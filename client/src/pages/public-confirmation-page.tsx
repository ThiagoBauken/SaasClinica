/**
 * Pagina Publica de Confirmacao de Agendamento
 *
 * Permite ao paciente confirmar ou cancelar a consulta atraves
 * de um link enviado via WhatsApp - sem necessidade de login.
 */

import React, { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, XCircle, AlertTriangle, Loader2, Calendar, Clock, User } from 'lucide-react';

// ==================== TIPOS ====================

interface AppointmentDetails {
  appointment: {
    id: number;
    title: string;
    date: string;
    endTime: string;
    status: string;
    notes: string | null;
  };
  patient: { name: string } | null;
  clinic: { name: string; logo: string | null };
  link: { action: string; expiresAt: string };
}

type PageState = 'loading' | 'ready' | 'confirming' | 'cancelling' | 'confirmed' | 'cancelled' | 'error' | 'expired' | 'used';

// ==================== HELPERS ====================

function formatDateTime(iso: string): { date: string; time: string } {
  const d = parseISO(iso);
  return {
    date: format(d, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
    time: format(d, 'HH:mm', { locale: ptBR }),
  };
}

async function apiFetch(url: string, method = 'GET') {
  const resp = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await resp.json();
  if (!resp.ok) throw { status: resp.status, message: data.error ?? 'Erro desconhecido' };
  return data;
}

// ==================== SUBCOMPONENTES ====================

function ClinicHeader({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 mb-6">
      {logo ? (
        <img src={logo} alt={name} className="h-16 w-auto object-contain" />
      ) : (
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
          style={{ backgroundColor: '#2563eb' }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <h1 className="text-xl font-semibold text-gray-800">{name}</h1>
    </div>
  );
}

function AppointmentCard({ data }: { data: AppointmentDetails }) {
  const { date, time } = formatDateTime(data.appointment.date);
  const endTime = format(parseISO(data.appointment.endTime), 'HH:mm', { locale: ptBR });

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 space-y-3">
      <h2 className="font-semibold text-blue-900 text-lg">{data.appointment.title}</h2>

      {data.patient && (
        <div className="flex items-center gap-2 text-gray-700">
          <User className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <span>{data.patient.name}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-gray-700">
        <Calendar className="h-4 w-4 text-blue-500 flex-shrink-0" />
        <span className="capitalize">{date}</span>
      </div>

      <div className="flex items-center gap-2 text-gray-700">
        <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
        <span>
          {time} - {endTime}
        </span>
      </div>

      {data.appointment.notes && (
        <p className="text-sm text-gray-600 border-t border-blue-200 pt-3 mt-3">
          {data.appointment.notes}
        </p>
      )}
    </div>
  );
}

// ==================== ESTADOS FINAIS ====================

function SuccessScreen({ action }: { action: 'confirmed' | 'cancelled' }) {
  const isConfirmed = action === 'confirmed';
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      {isConfirmed ? (
        <CheckCircle className="h-20 w-20 text-green-500" />
      ) : (
        <XCircle className="h-20 w-20 text-red-400" />
      )}
      <h2 className="text-2xl font-bold text-gray-800">
        {isConfirmed ? 'Presenca Confirmada!' : 'Consulta Cancelada'}
      </h2>
      <p className="text-gray-600 max-w-xs">
        {isConfirmed
          ? 'Otimo! Sua presenca foi confirmada. Te esperamos na data marcada.'
          : 'Consulta cancelada. Para reagendar, entre em contato conosco.'}
      </p>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <AlertTriangle className="h-20 w-20 text-yellow-500" />
      <h2 className="text-2xl font-bold text-gray-800">Link Invalido</h2>
      <p className="text-gray-600 max-w-xs">{message}</p>
    </div>
  );
}

function ExpiredScreen() {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <AlertTriangle className="h-20 w-20 text-orange-500" />
      <h2 className="text-2xl font-bold text-gray-800">Link Expirado</h2>
      <p className="text-gray-600 max-w-xs">
        Este link nao esta mais disponivel. Por favor, entre em contato com a clinica.
      </p>
    </div>
  );
}

function UsedScreen() {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <CheckCircle className="h-20 w-20 text-gray-400" />
      <h2 className="text-2xl font-bold text-gray-800">Ja Utilizado</h2>
      <p className="text-gray-600 max-w-xs">
        Este link ja foi utilizado anteriormente. Sua resposta ja foi registrada.
      </p>
    </div>
  );
}

// ==================== PAGINA PRINCIPAL ====================

export default function PublicConfirmationPage() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [finalAction, setFinalAction] = useState<'confirmed' | 'cancelled' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Buscar detalhes do agendamento
  const { data, isLoading } = useQuery<AppointmentDetails>({
    queryKey: ['confirmation', token],
    queryFn: async () => {
      const result = await apiFetch(`/api/public/confirm/${token}`);
      setPageState('ready');
      return result;
    },
    retry: false,
    enabled: !!token,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throwOnError: (err: any) => {
      if (err.status === 410) {
        if (err.message?.includes('expirado')) {
          setPageState('expired');
        } else {
          setPageState('used');
        }
      } else {
        setErrorMessage(err.message ?? 'Erro ao carregar dados do agendamento.');
        setPageState('error');
      }
      return false;
    },
  });

  // Mutacao: confirmar
  const confirmMutation = useMutation({
    mutationFn: () => apiFetch(`/api/public/confirm/${token}/confirm`, 'POST'),
    onSuccess: () => {
      setFinalAction('confirmed');
      setPageState('confirmed');
    },
    onError: (err: any) => {
      setErrorMessage(err.message ?? 'Erro ao confirmar consulta.');
      setPageState('error');
    },
  });

  // Mutacao: cancelar
  const cancelMutation = useMutation({
    mutationFn: () => apiFetch(`/api/public/confirm/${token}/cancel`, 'POST'),
    onSuccess: () => {
      setFinalAction('cancelled');
      setPageState('cancelled');
    },
    onError: (err: any) => {
      setErrorMessage(err.message ?? 'Erro ao cancelar consulta.');
      setPageState('error');
    },
  });

  const isActing = confirmMutation.isPending || cancelMutation.isPending;

  // ---- RENDER ----
  return (
    <div
      className="min-h-screen flex items-start justify-center py-10 px-4"
      style={{ backgroundColor: '#f1f5f9' }}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6"
        style={{ maxWidth: '440px' }}
      >
        {/* Loading inicial */}
        {(isLoading || pageState === 'loading') && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="text-gray-500">Carregando informacoes...</p>
          </div>
        )}

        {/* Erro */}
        {pageState === 'error' && <ErrorScreen message={errorMessage} />}

        {/* Link expirado */}
        {pageState === 'expired' && <ExpiredScreen />}

        {/* Link ja usado */}
        {pageState === 'used' && <UsedScreen />}

        {/* Confirmado ou Cancelado */}
        {(pageState === 'confirmed' || pageState === 'cancelled') && finalAction && (
          <>
            {data && <ClinicHeader name={data.clinic.name} logo={data.clinic.logo} />}
            <SuccessScreen action={finalAction} />
          </>
        )}

        {/* Estado principal - exibir detalhes e botoes */}
        {pageState === 'ready' && data && (
          <>
            <ClinicHeader name={data.clinic.name} logo={data.clinic.logo} />

            <p className="text-center text-gray-600 mb-4">
              Voce deseja confirmar ou cancelar esta consulta?
            </p>

            <AppointmentCard data={data} />

            {/* Botoes de acao */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => confirmMutation.mutate()}
                disabled={isActing}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl text-white font-semibold text-lg transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#16a34a' }}
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
                Confirmar Presenca
              </button>

              <button
                onClick={() => cancelMutation.mutate()}
                disabled={isActing}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl text-white font-semibold text-lg transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#dc2626' }}
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                Cancelar Consulta
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">
              Link valido ate{' '}
              {format(parseISO(data.link.expiresAt), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
