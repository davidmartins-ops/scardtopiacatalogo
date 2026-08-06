import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Column, Container, Head, Heading, Hr, Html, Preview, Row, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Spencer's Cardtopia"
const SITE_URL = 'https://www.spencerscardtopia.com.br'

interface OrderItem {
  name?: string
  quantity?: number
  unit_price?: number
  total_price?: number
  language?: string
  condition?: string
}

interface AdminOrderPaidProps {
  orderId?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  paymentMethod?: string
  total?: number
  creditsApplied?: number
  items?: OrderItem[]
  city?: string
  state?: string
}

const fmt = (v?: number) =>
  `R$ ${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  credit: 'Crédito',
  debit: 'Débito',
  whatsapp: 'WhatsApp',
  other: 'Outro',
}

const AdminOrderPaidEmail = ({
  orderId = '',
  customerName,
  customerEmail,
  customerPhone,
  paymentMethod = 'other',
  total,
  creditsApplied = 0,
  items = [],
  city,
  state,
}: AdminOrderPaidProps) => {
  const shortId = orderId.slice(0, 8).toUpperCase()
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`Pagamento confirmado — pedido #${shortId} (${fmt(total)})`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={brand}>{SITE_NAME}</Heading>
          <Heading style={h1}>Pagamento confirmado</Heading>
          <Text style={text}>
            O pedido <strong>#{shortId}</strong> foi pago e está pronto para separação.
          </Text>

          <Section style={box}>
            <Row style={line}>
              <Column><Text style={label}>Cliente</Text></Column>
              <Column align="right"><Text style={value}>{customerName ?? '—'}</Text></Column>
            </Row>
            {customerEmail && (
              <Row style={line}>
                <Column><Text style={label}>E-mail</Text></Column>
                <Column align="right"><Text style={value}>{customerEmail}</Text></Column>
              </Row>
            )}
            {customerPhone && (
              <Row style={line}>
                <Column><Text style={label}>Telefone</Text></Column>
                <Column align="right"><Text style={value}>{customerPhone}</Text></Column>
              </Row>
            )}
            {(city || state) && (
              <Row style={line}>
                <Column><Text style={label}>Destino</Text></Column>
                <Column align="right">
                  <Text style={value}>{[city, state].filter(Boolean).join('/')}</Text>
                </Column>
              </Row>
            )}
            <Row style={line}>
              <Column><Text style={label}>Pagamento</Text></Column>
              <Column align="right">
                <Text style={value}>{METHOD_LABELS[paymentMethod] ?? paymentMethod}</Text>
              </Column>
            </Row>
            {creditsApplied > 0 && (
              <Row style={line}>
                <Column><Text style={label}>Créditos usados</Text></Column>
                <Column align="right"><Text style={value}>{fmt(creditsApplied)}</Text></Column>
              </Row>
            )}
            <Hr style={hrLight} />
            <Row>
              <Column><Text style={label}>Total</Text></Column>
              <Column align="right"><Text style={totalValue}>{fmt(total)}</Text></Column>
            </Row>
          </Section>

          {items.length > 0 && (
            <Section style={box}>
              <Text style={itemsTitle}>Itens</Text>
              {items.map((it, idx) => (
                <Row key={idx} style={line}>
                  <Column>
                    <Text style={itemName}>{it.name ?? 'Item'}</Text>
                    {(it.language || it.condition) && (
                      <Text style={itemMeta}>
                        {[it.language, it.condition].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    <Text style={itemMeta}>{it.quantity ?? 1} × {fmt(it.unit_price)}</Text>
                  </Column>
                  <Column align="right" style={{ verticalAlign: 'top' }}>
                    <Text style={value}>{fmt(it.total_price)}</Text>
                  </Column>
                </Row>
              ))}
            </Section>
          )}

          <Button href={`${SITE_URL}/admin/pedidos/${orderId}`} style={button}>
            Abrir pedido no painel
          </Button>

          <Hr style={hr} />
          <Text style={footer}>
            Aviso automático para administradores.<br />
            {SITE_NAME}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AdminOrderPaidEmail,
  subject: (data: Record<string, any>) =>
    `Pagamento confirmado — pedido #${(data.orderId ?? '').slice(0, 8).toUpperCase()}`,
  displayName: 'Pedido pago (admin)',
  previewData: {
    orderId: '12345678-abcd-efgh-ijkl-000000000000',
    customerName: 'Cliente Exemplo',
    customerEmail: 'cliente@example.com',
    customerPhone: '11 99999-9999',
    paymentMethod: 'pix',
    total: 249.9,
    creditsApplied: 20,
    city: 'Mogi das Cruzes',
    state: 'SP',
    items: [
      { name: 'Secret Lair Drop X', quantity: 1, unit_price: 199.9, total_price: 199.9 },
      { name: 'Sol Ring', language: 'EN', condition: 'NM', quantity: 2, unit_price: 25, total_price: 50 },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '14px', color: '#a78448', letterSpacing: '0.12em', textTransform: 'uppercase' as const, margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#1f1d1a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3a3631', lineHeight: '1.55', margin: '0 0 18px' }
const box = { backgroundColor: '#fdfaf3', border: '1px solid #e8dcc4', borderRadius: '10px', padding: '16px 18px', margin: '0 0 22px' }
const line = { borderBottom: '1px solid #efe6d2' }
const label = { fontSize: '13px', color: '#55504a', margin: '8px 0' }
const value = { fontSize: '14px', color: '#1f1d1a', fontWeight: 'bold', margin: '8px 0' }
const totalValue = { fontSize: '16px', color: '#a78448', fontWeight: 'bold', margin: '8px 0' }
const itemsTitle = { fontSize: '13px', color: '#7a6f5d', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 12px', fontWeight: 'bold' }
const itemName = { fontSize: '14px', color: '#1f1d1a', fontWeight: 'bold', margin: '8px 0 2px' }
const itemMeta = { fontSize: '12px', color: '#7a6f5d', margin: '0 0 2px' }
const hrLight = { borderColor: '#e8dcc4', margin: '8px 0' }
const button = { backgroundColor: '#a78448', color: '#ffffff', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold', display: 'inline-block' }
const hr = { borderColor: '#e8dcc4', margin: '28px 0' }
const footer = { fontSize: '13px', color: '#7a6f5d', margin: '20px 0 0', lineHeight: '1.6' }
