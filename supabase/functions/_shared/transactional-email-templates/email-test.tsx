import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Spencer's Cardtopia"

interface EmailTestProps {
  senderDomain?: string
  fromAddress?: string
  triggeredBy?: string
  sentAt?: string
}

const EmailTest = ({
  senderDomain = '',
  fromAddress = '',
  triggeredBy = '',
  sentAt = '',
}: EmailTestProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Teste de envio de e-mail transacional</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>{SITE_NAME}</Heading>
        <Heading style={h1}>Teste de envio confirmado</Heading>
        <Text style={text}>
          Este é um e-mail de teste disparado pelo painel administrativo. Ele usa exatamente o
          mesmo remetente e a mesma fila dos e-mails transacionais reais.
        </Text>

        <Section style={box}>
          <Text style={label}>Remetente (From)</Text>
          <Text style={value}>{fromAddress || '—'}</Text>
          <Hr style={hrLight} />
          <Text style={label}>Domínio verificado (sender_domain)</Text>
          <Text style={value}>{senderDomain || '—'}</Text>
          <Hr style={hrLight} />
          <Text style={label}>Solicitado por</Text>
          <Text style={value}>{triggeredBy || '—'}</Text>
          <Hr style={hrLight} />
          <Text style={label}>Enviado em</Text>
          <Text style={value}>{sentAt || '—'}</Text>
        </Section>

        <Text style={text}>
          Se você recebeu esta mensagem, a configuração de domínio de envio está funcionando.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>Mensagem de diagnóstico · {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EmailTest,
  subject: 'Teste de envio — Spencer\'s Cardtopia',
  displayName: 'Teste de envio (diagnóstico)',
  previewData: {
    senderDomain: 'notify.spencerscardtopia.com.br',
    fromAddress: 'scardtopiacatalogo <noreply@spencerscardtopia.com.br>',
    triggeredBy: 'admin@spencerscardtopia.com.br',
    sentAt: '20/08/2026 14:05',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '14px', color: '#a78448', letterSpacing: '0.12em', textTransform: 'uppercase' as const, margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#1f1d1a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3a3631', lineHeight: '1.55', margin: '0 0 18px' }
const box = { backgroundColor: '#fdfaf3', border: '1px solid #e8dcc4', borderRadius: '10px', padding: '16px 18px', margin: '0 0 22px' }
const label = { fontSize: '12px', color: '#7a6f5d', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '6px 0 2px' }
const value = { fontSize: '14px', color: '#1f1d1a', fontWeight: 'bold', margin: '0 0 6px' }
const hrLight = { borderColor: '#efe6d2', margin: '10px 0' }
const hr = { borderColor: '#e8dcc4', margin: '28px 0' }
const footer = { fontSize: '13px', color: '#7a6f5d', margin: '20px 0 0', lineHeight: '1.6' }
