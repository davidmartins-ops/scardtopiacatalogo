import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Column, Container, Head, Heading, Hr, Html, Preview, Row, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Spencer's Cardtopia"
const SITE_URL = 'https://www.spencerscardtopia.com.br'

interface Item {
  name?: string
  description?: string
  variantLabel?: string
  sku?: string
  quantity?: number
  unit_price?: number
  unit_price_pix?: number
  total_price?: number
  item_type?: string
}

interface Props {
  customerName?: string
  orderId?: string
  status?: string
  statusLabel?: string
  total?: number
  items?: Item[]
  note?: string | null
  trackingCode?: string | null
}

const NEXT_STEPS: Record<string, string> = {
  requested: 'Estamos avaliando disponibilidade, preço e prazo. Em breve você receberá a cotação.',
  quoted: 'Sua cotação está disponível: acesse a encomenda para aprovar ou recusar.',
  approved: 'Cotação aprovada! Escolha a forma de pagamento na página da encomenda.',
  paid: 'Pagamento confirmado. Vamos adquirir o item e avisaremos quando chegar.',
  ordered: 'O item foi encomendado com o fornecedor. Avisaremos quando chegar.',
  received: 'O item chegou! Estamos preparando o envio.',
  shipped: 'Sua encomenda foi enviada. Acompanhe pelo código de rastreio.',
  delivered: 'Encomenda entregue. Obrigado pela confiança!',
  cancelled: 'Esta encomenda foi cancelada. Qualquer dúvida, responda este e-mail.',
}

const fmt = (v?: number) =>
  `R$ ${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const SpecialOrderStatusEmail = ({
  customerName,
  orderId = '',
  status = 'requested',
  statusLabel = 'Atualizada',
  total = 0,
  items = [],
  note,
  trackingCode,
}: Props) => {
  const shortId = orderId.slice(0, 8).toUpperCase()

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`Encomenda #${shortId}: ${statusLabel}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={brand}>{SITE_NAME}</Heading>
          <Heading style={h1}>
            {customerName ? `Olá, ${customerName}!` : 'Olá!'}
          </Heading>
          <Text style={text}>
            Sua encomenda <strong>#{shortId}</strong> agora está com o status{' '}
            <strong>{statusLabel}</strong>.
          </Text>

          <Section style={noticeBox}>
            <Text style={noticeTitle}>Próximos passos</Text>
            <Text style={noticeText}>{NEXT_STEPS[status] ?? 'Acompanhe a encomenda na sua conta.'}</Text>
            {note && <Text style={noticeText}>{note}</Text>}
            {trackingCode && <Text style={noticeText}>Código de rastreio: {trackingCode}</Text>}
          </Section>

          {items.length > 0 && (
            <Section style={itemsBox}>
              <Text style={itemsTitle}>Itens da encomenda</Text>
              {items.map((it, idx) => (
                <Row key={idx} style={itemRow}>
                  <Column>
                    <Text style={itemName}>
                      {it.name ?? 'Item'}{it.variantLabel ? ` — ${it.variantLabel}` : ''}
                    </Text>
                    {it.sku && <Text style={itemMeta}>SKU: {it.sku}</Text>}
                    {it.description && <Text style={itemMeta}>{it.description}</Text>}
                    <Text style={itemMeta}>
                      {it.quantity ?? 1} × {it.item_type === 'quotation' && !it.unit_price ? 'sob cotação' : fmt(it.unit_price)}
                      {it.unit_price_pix ? ` (PIX ${fmt(it.unit_price_pix)})` : ''}
                    </Text>
                  </Column>
                  <Column align="right" style={{ verticalAlign: 'top' }}>
                    <Text style={itemTotal}>{fmt(it.total_price)}</Text>
                  </Column>
                </Row>
              ))}
              <Hr style={hrLight} />
              <Row>
                <Column><Text style={totalLabel}>Total</Text></Column>
                <Column align="right"><Text style={totalValue}>{fmt(total)}</Text></Column>
              </Row>
            </Section>
          )}

          <Button href={`${SITE_URL}/conta/encomendas/${orderId}`} style={buttonPrimary}>
            Ver encomenda
          </Button>

          <Hr style={hr} />
          <Text style={footer}>
            Em caso de dúvidas, basta responder este e-mail.<br />
            Equipe {SITE_NAME}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SpecialOrderStatusEmail,
  subject: (data: Record<string, any>) =>
    `Encomenda #${(data.orderId ?? '').slice(0, 8).toUpperCase()}: ${data.statusLabel ?? 'atualizada'}`,
  displayName: 'Encomenda — atualização de status',
  previewData: {
    customerName: 'Cliente',
    orderId: '12345678-abcd-efgh-ijkl-000000000000',
    status: 'quoted',
    statusLabel: 'Cotada',
    total: 480,
    items: [
      { name: 'Funko Pop! Chandra', variantLabel: 'Versão Deluxe', sku: 'FP-CHA-DLX', quantity: 1, unit_price: 480, unit_price_pix: 456, total_price: 480 },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '14px', color: '#a78448', letterSpacing: '0.12em', textTransform: 'uppercase' as const, margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#1f1d1a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3a3631', lineHeight: '1.55', margin: '0 0 18px' }
const itemsBox = { backgroundColor: '#fdfaf3', border: '1px solid #e8dcc4', borderRadius: '10px', padding: '16px 18px', margin: '0 0 22px' }
const itemsTitle = { fontSize: '13px', color: '#7a6f5d', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 12px', fontWeight: 'bold' }
const itemRow = { borderBottom: '1px solid #efe6d2' }
const itemName = { fontSize: '14px', color: '#1f1d1a', fontWeight: 'bold', margin: '8px 0 2px' }
const itemMeta = { fontSize: '12px', color: '#7a6f5d', margin: '0 0 2px' }
const itemTotal = { fontSize: '14px', color: '#1f1d1a', fontWeight: 'bold', margin: '8px 0' }
const totalLabel = { fontSize: '14px', color: '#3a3631', fontWeight: 'bold', margin: '8px 0 0' }
const totalValue = { fontSize: '16px', color: '#a78448', fontWeight: 'bold', margin: '8px 0 0' }
const hrLight = { borderColor: '#e8dcc4', margin: '8px 0' }
const noticeBox = { backgroundColor: '#f8f4ec', borderLeft: '3px solid #a78448', borderRadius: '6px', padding: '14px 16px', margin: '0 0 22px' }
const noticeTitle = { fontSize: '13px', color: '#a78448', fontWeight: 'bold', margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const noticeText = { fontSize: '14px', color: '#3a3631', lineHeight: '1.55', margin: '0 0 6px' }
const buttonPrimary = { backgroundColor: '#a78448', color: '#ffffff', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold', display: 'inline-block' }
const hr = { borderColor: '#e8dcc4', margin: '28px 0' }
const footer = { fontSize: '13px', color: '#7a6f5d', margin: '20px 0 0', lineHeight: '1.6' }
