import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Row, Column, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Spencer's Cardtopia"
const SITE_URL = 'https://www.spencerscardtopia.com.br'

interface OrderItem {
  name?: string
  description?: string
  quantity?: number
  unit_price?: number
  total_price?: number
  language?: string
  condition?: string
}

interface Props {
  customerName?: string
  orderId?: string
  total?: number
  paymentMethod?: string
  items?: OrderItem[]
}

const PAYMENT_LABEL: Record<string, string> = {
  pix: 'PIX',
  credit: 'Cartão de crédito',
  whatsapp: 'WhatsApp',
}

const fmt = (v?: number) =>
  `R$ ${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const OrderReceivedEmail = ({
  customerName,
  orderId = '',
  total = 0,
  paymentMethod = 'whatsapp',
  items = [],
}: Props) => {
  const shortId = orderId.slice(0, 8).toUpperCase()
  const isPix = paymentMethod === 'pix'
  const paymentLabel = PAYMENT_LABEL[paymentMethod] ?? paymentMethod

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`Pedido #${shortId} recebido — ${fmt(total)}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={brand}>{SITE_NAME}</Heading>
          <Heading style={h1}>
            {customerName ? `Obrigado, ${customerName}!` : 'Obrigado pelo seu pedido!'}
          </Heading>
          <Text style={text}>
            Recebemos o seu pedido <strong>#{shortId}</strong> e ele já está registrado em nosso sistema.
          </Text>

          <Section style={infoBox}>
            <Row>
              <Column>
                <Text style={infoLabel}>Forma de pagamento</Text>
                <Text style={infoValue}>{paymentLabel}</Text>
              </Column>
              <Column>
                <Text style={infoLabel}>Total</Text>
                <Text style={infoValueStrong}>{fmt(total)}</Text>
              </Column>
            </Row>
          </Section>

          {items.length > 0 && (
            <Section style={itemsBox}>
              <Text style={itemsTitle}>Itens do pedido</Text>
              {items.map((it, idx) => (
                <Row key={idx} style={itemRow}>
                  <Column>
                    <Text style={itemName}>{it.name ?? 'Item'}</Text>
                    {(it.language || it.condition) && (
                      <Text style={itemMeta}>
                        {[it.language, it.condition].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    <Text style={itemMeta}>
                      {it.quantity ?? 1} × {fmt(it.unit_price)}
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

          {isPix ? (
            <Section style={noticeBox}>
              <Text style={noticeTitle}>Próximos passos — PIX</Text>
              <Text style={noticeText}>
                Aguardamos a confirmação do seu pagamento. Assim que o comprovante for validado,
                seu pedido entrará em preparação e você receberá uma nova atualização por e-mail.
              </Text>
            </Section>
          ) : (
            <Section style={noticeBox}>
              <Text style={noticeTitle}>Próximos passos</Text>
              <Text style={noticeText}>
                Já estamos analisando o seu pedido. Você receberá novos e-mails a cada mudança de
                status — confirmação de pagamento, preparação e envio com código de rastreio.
              </Text>
            </Section>
          )}

          <Button href={`${SITE_URL}/conta?tab=orders`} style={buttonPrimary}>
            Acompanhar pedido
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
  component: OrderReceivedEmail,
  subject: (data: Record<string, any>) => {
    const id = (data.orderId ?? '').slice(0, 8).toUpperCase()
    return `Recebemos seu pedido #${id}`
  },
  displayName: 'Pedido recebido',
  previewData: {
    customerName: 'Cliente',
    orderId: '12345678-abcd-efgh-ijkl-000000000000',
    total: 249.9,
    paymentMethod: 'pix',
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
const infoBox = { backgroundColor: '#f8f4ec', border: '1px solid #e8dcc4', borderRadius: '10px', padding: '14px 18px', margin: '0 0 18px' }
const infoLabel = { fontSize: '11px', color: '#7a6f5d', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 4px' }
const infoValue = { fontSize: '15px', color: '#1f1d1a', margin: 0 }
const infoValueStrong = { fontSize: '17px', color: '#a78448', fontWeight: 'bold', margin: 0 }
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
const noticeText = { fontSize: '14px', color: '#3a3631', lineHeight: '1.55', margin: 0 }
const buttonPrimary = { backgroundColor: '#a78448', color: '#ffffff', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold', display: 'inline-block' }
const hr = { borderColor: '#e8dcc4', margin: '28px 0' }
const footer = { fontSize: '13px', color: '#7a6f5d', margin: '20px 0 0', lineHeight: '1.6' }
