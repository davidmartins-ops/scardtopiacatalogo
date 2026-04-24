import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Spencer's Cardtopia"
const SITE_URL = 'https://www.spencerscardtopia.com.br'

interface OrderStatusUpdateProps {
  customerName?: string
  orderId?: string
  status?: string
  trackingCode?: string
  note?: string
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Aguardando pagamento',
  payment_confirmed: 'Pagamento confirmado',
  preparing: 'Em preparação',
  shipped: 'Despachado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

const STATUS_MESSAGE: Record<string, string> = {
  pending_payment: 'Estamos aguardando a confirmação do seu pagamento. Assim que confirmarmos, daremos andamento.',
  payment_confirmed: 'Recebemos seu pagamento! Em breve seu pedido entrará em preparação.',
  preparing: 'Estamos separando suas cartas com todo o cuidado. Em breve seu pedido será despachado.',
  shipped: 'Seu pedido foi despachado! Acompanhe pelo código de rastreio abaixo.',
  delivered: 'Seu pedido foi entregue. Esperamos que aproveite suas cartas!',
  cancelled: 'Seu pedido foi cancelado. Em caso de dúvidas, entre em contato conosco.',
}

const OrderStatusUpdateEmail = ({
  customerName,
  orderId = '',
  status = 'payment_confirmed',
  trackingCode,
  note,
}: OrderStatusUpdateProps) => {
  const statusLabel = STATUS_LABELS[status] ?? status
  const statusMessage = STATUS_MESSAGE[status] ?? 'Houve uma atualização no seu pedido.'
  const shortId = orderId.slice(0, 8).toUpperCase()

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`Pedido #${shortId}: ${statusLabel}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={brand}>{SITE_NAME}</Heading>
          <Heading style={h1}>
            {customerName ? `Olá, ${customerName}!` : 'Olá!'}
          </Heading>
          <Text style={text}>
            Seu pedido <strong>#{shortId}</strong> teve uma atualização:
          </Text>
          <Section style={statusBox}>
            <Text style={statusLine}>{statusLabel}</Text>
            <Text style={statusDesc}>{statusMessage}</Text>
          </Section>

          {trackingCode && (
            <Section style={trackingBox}>
              <Text style={trackingLabel}>Código de rastreio</Text>
              <Text style={trackingValue}>{trackingCode}</Text>
              <Button
                href={`https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(trackingCode)}`}
                style={button}
              >
                Rastrear nos Correios
              </Button>
            </Section>
          )}

          {note && (
            <Section style={noteBox}>
              <Text style={noteLabel}>Observação:</Text>
              <Text style={noteText}>{note}</Text>
            </Section>
          )}

          <Hr style={hr} />

          <Button href={`${SITE_URL}/conta?tab=orders`} style={buttonSecondary}>
            Ver detalhes do pedido
          </Button>

          <Text style={footer}>
            Atenciosamente,<br />
            Equipe {SITE_NAME}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OrderStatusUpdateEmail,
  subject: (data: Record<string, any>) => {
    const label = STATUS_LABELS[data.status] ?? 'Atualização'
    const id = (data.orderId ?? '').slice(0, 8).toUpperCase()
    return `Pedido #${id}: ${label}`
  },
  displayName: 'Atualização de pedido',
  previewData: {
    customerName: 'Cliente',
    orderId: '12345678-abcd-efgh-ijkl-000000000000',
    status: 'shipped',
    trackingCode: 'BR123456789BR',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '14px', color: '#a78448', letterSpacing: '0.12em', textTransform: 'uppercase' as const, margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#1f1d1a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3a3631', lineHeight: '1.55', margin: '0 0 18px' }
const statusBox = { backgroundColor: '#f8f4ec', border: '1px solid #e8dcc4', borderRadius: '10px', padding: '18px 20px', margin: '0 0 22px' }
const statusLine = { fontSize: '17px', fontWeight: 'bold', color: '#a78448', margin: '0 0 6px' }
const statusDesc = { fontSize: '14px', color: '#55504a', lineHeight: '1.5', margin: 0 }
const trackingBox = { backgroundColor: '#fdfaf3', border: '1px dashed #d6c39a', borderRadius: '10px', padding: '18px 20px', margin: '0 0 22px', textAlign: 'center' as const }
const trackingLabel = { fontSize: '12px', color: '#7a6f5d', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 6px' }
const trackingValue = { fontSize: '18px', fontWeight: 'bold', color: '#1f1d1a', fontFamily: 'monospace', margin: '0 0 14px' }
const noteBox = { backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '14px 16px', margin: '0 0 22px' }
const noteLabel = { fontSize: '12px', color: '#7a6f5d', fontWeight: 'bold', margin: '0 0 4px' }
const noteText = { fontSize: '14px', color: '#3a3631', lineHeight: '1.5', margin: 0 }
const button = { backgroundColor: '#a78448', color: '#ffffff', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold', display: 'inline-block' }
const buttonSecondary = { backgroundColor: '#1f1d1a', color: '#ffffff', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold', display: 'inline-block' }
const hr = { borderColor: '#e8dcc4', margin: '28px 0' }
const footer = { fontSize: '13px', color: '#7a6f5d', margin: '20px 0 0', lineHeight: '1.6' }
