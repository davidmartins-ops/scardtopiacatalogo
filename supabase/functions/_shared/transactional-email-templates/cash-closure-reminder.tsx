import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Column, Container, Head, Heading, Hr, Html, Preview, Row, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Spencer's Cardtopia"
const SITE_URL = 'https://www.spencerscardtopia.com.br'

interface CashClosureReminderProps {
  dateLabel?: string
  totalOrders?: number
  totalExpected?: number
  totalReceived?: number
  divergence?: number
  pendingCount?: number
}

const fmt = (v?: number) =>
  `R$ ${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const CashClosureReminderEmail = ({
  dateLabel = '',
  totalOrders = 0,
  totalExpected = 0,
  totalReceived = 0,
  divergence = 0,
  pendingCount = 0,
}: CashClosureReminderProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`Fechamento de caixa pendente — ${dateLabel}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>{SITE_NAME}</Heading>
        <Heading style={h1}>Fechamento de caixa pendente</Heading>
        <Text style={text}>
          O caixa do dia <strong>{dateLabel}</strong> ainda não foi fechado. Confira o resumo abaixo
          e finalize a conciliação.
        </Text>

        <Section style={box}>
          <Row style={line}>
            <Column><Text style={label}>Pedidos pagos</Text></Column>
            <Column align="right"><Text style={value}>{totalOrders}</Text></Column>
          </Row>
          <Row style={line}>
            <Column><Text style={label}>Total esperado</Text></Column>
            <Column align="right"><Text style={value}>{fmt(totalExpected)}</Text></Column>
          </Row>
          <Row style={line}>
            <Column><Text style={label}>Total recebido (conciliado)</Text></Column>
            <Column align="right"><Text style={value}>{fmt(totalReceived)}</Text></Column>
          </Row>
          <Hr style={hrLight} />
          <Row>
            <Column><Text style={label}>Divergência</Text></Column>
            <Column align="right">
              <Text style={divergence === 0 ? valueOk : valueAlert}>{fmt(divergence)}</Text>
            </Column>
          </Row>
        </Section>

        {pendingCount > 0 && (
          <Section style={warnBox}>
            <Text style={warnText}>
              {pendingCount} pedido(s) sem conciliação registrada neste dia.
            </Text>
          </Section>
        )}

        <Button href={`${SITE_URL}/admin/reconciliacao`} style={button}>
          Fechar caixa agora
        </Button>

        <Hr style={hr} />
        <Text style={footer}>
          Aviso automático diário enviado às 20h.<br />
          {SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CashClosureReminderEmail,
  subject: (data: Record<string, any>) =>
    `Fechamento de caixa pendente — ${data.dateLabel ?? 'hoje'}`,
  displayName: 'Lembrete de fechamento de caixa (admin)',
  previewData: {
    dateLabel: '06/08/2026',
    totalOrders: 7,
    totalExpected: 1899.5,
    totalReceived: 1750,
    divergence: -149.5,
    pendingCount: 2,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '14px', color: '#a78448', letterSpacing: '0.12em', textTransform: 'uppercase' as const, margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#1f1d1a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3a3631', lineHeight: '1.55', margin: '0 0 18px' }
const box = { backgroundColor: '#fdfaf3', border: '1px solid #e8dcc4', borderRadius: '10px', padding: '16px 18px', margin: '0 0 22px' }
const line = { borderBottom: '1px solid #efe6d2' }
const label = { fontSize: '14px', color: '#55504a', margin: '8px 0' }
const value = { fontSize: '14px', color: '#1f1d1a', fontWeight: 'bold', margin: '8px 0' }
const valueOk = { ...value, color: '#2f7a4f' }
const valueAlert = { ...value, color: '#b3261e' }
const warnBox = { backgroundColor: '#fdf3f2', border: '1px solid #f0cfcb', borderRadius: '8px', padding: '14px 16px', margin: '0 0 22px' }
const warnText = { fontSize: '14px', color: '#b3261e', margin: 0 }
const button = { backgroundColor: '#a78448', color: '#ffffff', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold', display: 'inline-block' }
const hr = { borderColor: '#e8dcc4', margin: '28px 0' }
const footer = { fontSize: '13px', color: '#7a6f5d', margin: '20px 0 0', lineHeight: '1.6' }
