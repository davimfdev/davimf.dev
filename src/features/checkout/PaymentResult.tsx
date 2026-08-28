/**
 * Resultado do pagamento — dentro do site, sem redirect para página genérica.
 *
 * Pix e boleto mostram "Aguardando pagamento"; a confirmação definitiva vem do
 * backend (webhook), o polling só melhora a UX.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, Check, CheckCircle2, Clock, Copy, Download, ExternalLink, Loader2, XCircle,
} from 'lucide-react';
import { formatMoney, type PaymentView } from './api';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Aguardando pagamento',
  PROCESSING: 'Processando',
  PAID: 'Pagamento aprovado',
  DECLINED: 'Pagamento não aprovado',
  FAILED: 'Falha no pagamento',
  CANCELLED: 'Pagamento cancelado',
  EXPIRED: 'Prazo expirado',
  REFUNDED: 'Reembolsado',
  PARTIALLY_REFUNDED: 'Reembolsado parcialmente',
  CHARGEBACK: 'Em contestação',
};

const METHOD_LABEL: Record<string, string> = {
  pix: 'Pix',
  card: 'Cartão de crédito',
  boleto: 'Boleto bancário',
  subscription: 'Assinatura no cartão',
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="btn-secondary w-full text-sm py-2.5"
    >
      {copied ? <><Check size={15} className="mr-2 text-green-400" /> Copiado</> : <><Copy size={15} className="mr-2" /> {label}</>}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-white/[0.06] last:border-0">
      <span className="text-sm text-[#A8A8A4]">{label}</span>
      <span className="text-sm font-medium text-[#F5F3EF] text-right">{value}</span>
    </div>
  );
}

export function PaymentSummary({ payment }: { payment: PaymentView }) {
  return (
    <div className="mt-6">
      <Row label="Pedido" value={payment.orderReference} />
      <Row label="Plano" value={payment.productName} />
      <Row label="Valor" value={formatMoney(payment.amountCents, payment.currency)} />
      <Row label="Método" value={METHOD_LABEL[payment.method] ?? payment.method} />
      <Row label="Status" value={STATUS_LABEL[payment.status] ?? payment.status} />
      {payment.installments > 1 && <Row label="Parcelas" value={`${payment.installments}x`} />}
    </div>
  );
}

export function PaymentResult({ payment }: { payment: PaymentView }) {
  // ------------------------------------------------------------- aprovado --
  if (payment.status === 'PAID') {
    const license = payment.license;
    return (
      <div>
        <div className="text-center">
          <CheckCircle2 size={44} className="text-green-400 mx-auto mb-3" />
          <h3 className="text-2xl font-display font-bold text-[#F5F3EF]">Pagamento aprovado</h3>
          <p className="text-[#A8A8A4] mt-1">{payment.productName}</p>
        </div>

        {license && (
          <div className="mt-7">
            <p className="text-xs font-medium text-[#A8A8A4] uppercase tracking-wider mb-2">
              Sua chave de licença
            </p>
            <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-3.5">
              <code className="text-accent font-mono text-lg tracking-[0.15em] select-all break-all">
                {license.key ?? `${license.keyPrefix}…`}
              </code>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              {license.key ? (
                <CopyButton value={license.key} label="Copiar chave" />
              ) : (
                <Link to="/my-keys" className="btn-secondary w-full text-sm py-2.5">Ver em Minhas Chaves</Link>
              )}
              <a
                href={payment.downloadUrl}
                className="btn-primary w-full text-sm py-2.5"
                download
              >
                <Download size={15} className="mr-2" /> Baixar FMM
              </a>
            </div>

            <div className="mt-4 rounded-lg border-l-2 border-accent bg-accent/[0.06] px-4 py-3">
              <p className="text-xs font-semibold text-accent mb-1.5">Como ativar</p>
              <ol className="list-decimal list-inside space-y-0.5 text-xs text-[#A8A8A4] leading-relaxed">
                <li>Baixe e abra o FiveM Mod Manager.</li>
                <li>Vá em <span className="text-[#F5F3EF]">Configurações → Ativar Licença</span>.</li>
                <li>Cole a chave acima e confirme.</li>
              </ol>
            </div>

            <p className="text-[11px] text-[#6B6B67] mt-3 text-center">
              A chave também fica salva em <Link to="/my-keys" className="text-accent hover:underline">Minhas Chaves</Link> e foi enviada por e-mail.
            </p>
          </div>
        )}

        <PaymentSummary payment={payment} />
      </div>
    );
  }

  // ------------------------------------------------------------------ Pix --
  if (payment.method === 'pix' && payment.pix?.qrCode) {
    return (
      <div>
        <div className="text-center">
          <Clock size={40} className="text-accent mx-auto mb-3" />
          <h3 className="text-xl font-display font-bold text-[#F5F3EF]">Aguardando pagamento</h3>
          <p className="text-sm text-[#A8A8A4] mt-1">
            Escaneie o QR Code ou use o Pix Copia e Cola. A liberação é automática.
          </p>
        </div>

        {payment.pix.qrCodeBase64 && (
          <div className="flex justify-center mt-6">
            <img
              src={`data:image/png;base64,${payment.pix.qrCodeBase64}`}
              alt="QR Code do Pix"
              className="w-52 h-52 rounded-xl bg-white p-2"
            />
          </div>
        )}

        <div className="mt-5">
          <p className="text-xs font-medium text-[#A8A8A4] mb-2">Pix Copia e Cola</p>
          <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 mb-3">
            <code className="text-[11px] text-[#A8A8A4] break-all leading-relaxed line-clamp-3">
              {payment.pix.qrCode}
            </code>
          </div>
          <CopyButton value={payment.pix.qrCode} label="Copiar código Pix" />
        </div>

        <div className="flex items-center justify-center gap-2 mt-5 text-xs text-[#6B6B67]">
          <Loader2 size={12} className="animate-spin" />
          Verificando o pagamento…
        </div>

        <PaymentSummary payment={payment} />
      </div>
    );
  }

  // --------------------------------------------------------------- boleto --
  if (payment.method === 'boleto' && payment.boleto) {
    return (
      <div>
        <div className="text-center">
          <Clock size={40} className="text-accent mx-auto mb-3" />
          <h3 className="text-xl font-display font-bold text-[#F5F3EF]">Boleto gerado</h3>
          <p className="text-sm text-[#A8A8A4] mt-1">
            A compensação leva até 3 dias úteis. A licença é liberada assim que o pagamento for confirmado.
          </p>
        </div>

        {payment.boleto.digitableLine && (
          <div className="mt-6">
            <p className="text-xs font-medium text-[#A8A8A4] mb-2">Linha digitável</p>
            <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 mb-3">
              <code className="text-xs text-[#F5F3EF] break-all">{payment.boleto.digitableLine}</code>
            </div>
            <CopyButton value={payment.boleto.digitableLine} label="Copiar linha digitável" />
          </div>
        )}

        {payment.boleto.ticketUrl && (
          <a
            href={payment.boleto.ticketUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-primary w-full text-sm py-2.5 mt-3"
          >
            <ExternalLink size={15} className="mr-2" /> Abrir boleto
          </a>
        )}

        <PaymentSummary payment={payment} />
      </div>
    );
  }

  // ------------------------------------------------------------- recusado --
  if (payment.status === 'DECLINED' || payment.status === 'FAILED') {
    return (
      <div>
        <div className="text-center">
          <XCircle size={40} className="text-red-400 mx-auto mb-3" />
          <h3 className="text-xl font-display font-bold text-[#F5F3EF]">Pagamento não aprovado</h3>
          <p className="text-sm text-[#A8A8A4] mt-2 max-w-sm mx-auto">
            O banco emissor não autorizou a cobrança e nenhum valor foi debitado.
            Tente outro cartão ou pague com Pix.
          </p>
        </div>
        <PaymentSummary payment={payment} />
      </div>
    );
  }

  if (payment.status === 'EXPIRED' || payment.status === 'CANCELLED') {
    return (
      <div>
        <div className="text-center">
          <AlertCircle size={40} className="text-[#A8A8A4] mx-auto mb-3" />
          <h3 className="text-xl font-display font-bold text-[#F5F3EF]">
            {payment.status === 'EXPIRED' ? 'Prazo expirado' : 'Pagamento cancelado'}
          </h3>
          <p className="text-sm text-[#A8A8A4] mt-2">Nenhum valor foi cobrado. Você pode iniciar um novo pedido.</p>
        </div>
        <PaymentSummary payment={payment} />
      </div>
    );
  }

  // ---------------------------------------------------------- processando --
  return (
    <div className="text-center py-4">
      <Loader2 size={40} className="text-accent mx-auto mb-3 animate-spin" />
      <h3 className="text-xl font-display font-bold text-[#F5F3EF]">Processando pagamento</h3>
      <p className="text-sm text-[#A8A8A4] mt-2">
        {/* Houve desafio 3DS: ele já foi concluído e não é reaberto aqui — o
            status definitivo vem do backend (webhook/polling). */}
        {payment.threeDsUrl
          ? 'Estamos confirmando a autenticação com o banco emissor. Não feche esta janela.'
          : 'Isso pode levar alguns segundos. Não feche esta janela.'}
      </p>
      <PaymentSummary payment={payment} />
    </div>
  );
}
