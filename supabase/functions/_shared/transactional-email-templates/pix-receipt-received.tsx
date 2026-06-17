import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Spencer's Cardtopia"
const SITE_URL = 'https://www.spencerscardtopia.com.br'

interface Props {
  customerName?: string
  orderId?: string
  total?: number
}

const fmt = (v?: number) =>
  `R$ ${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const PixReceiptReceivedEmail = ({ customerName, orderId = '', total = 0 }: Props) => {
  const shortId = orderId.slice(0, 8).toUpperCase()
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`Comprovante PIX recebido — pedido #${shortId}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={brand}>{SITE_NAME}</Heading>
          <Heading style={h1}>
            {customerName ? `Olá, ${customerName}!` : 'Olá!'}
          </Heading>
          <Text style={text}>
            Recebemos o seu comprovante PIX do pedido <strong>#{shortId}</strong> no valor de{' '}
            <strong>{fmt(total)}</strong>.
          </Text>

          <Section style={statusBox}>
            <Text style={statusLine}>Comprovante em validação</Text>
            <Text style={statusDesc}>
              Nossa equipe está conferindo o pagamento. Esse processo costuma levar até algumas
              horas em dias úteis.
            </Text>
          </Section>

          <Section style={stepsBox}>
            <Text style={stepsTitle}>Próximos passos</Text>
            <Text style={stepItem}>1. Validamos o comprovante e confirmamos o pagamento.</Text>
            <Text style={stepItem}>2. Seu pedido entra em preparação.</Text>
            <Text style={stepItem}>3. Despachamos e enviamos o código de rastreio por e-mail.</Text>
          </Section>

          <Text style={text}>
            Você receberá uma nova mensagem a cada mudança de status. Não é necessária nenhuma
            ação adicional no momento.
          </Text>

          <Button href={`${SITE_URL}/conta?tab=orders`} style={buttonPrimary}>
            Ver detalhes do pedido
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
  component: PixReceiptReceivedEmail,
  subject: (data: Record<string, any>) => {
    const id = (data.orderId ?? '').slice(0, 8).toUpperCase()
    return `Comprovante PIX recebido — pedido #${id}`
  },
  displayName: 'Comprovante PIX recebido',
  previewData: {
    customerName: 'Cliente',
    orderId: '12345678-abcd-efgh-ijkl-000000000000',
    total: 249.9,
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
const stepsBox = { backgroundColor: '#fdfaf3', borderRadius: '10px', padding: '16px 18px', margin: '0 0 22px' }
const stepsTitle = { fontSize: '13px', color: '#7a6f5d', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 10px', fontWeight: 'bold' }
const stepItem = { fontSize: '14px', color: '#3a3631', lineHeight: '1.55', margin: '4px 0' }
const buttonPrimary = { backgroundColor: '#a78448', color: '#ffffff', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold', display: 'inline-block' }
const hr = { borderColor: '#e8dcc4', margin: '28px 0' }
const footer = { fontSize: '13px', color: '#7a6f5d', margin: '20px 0 0', lineHeight: '1.6' }
