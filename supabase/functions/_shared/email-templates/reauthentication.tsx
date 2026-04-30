/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brandMark}>SPENCER'S CARDTOPIA</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Confirme sua identidade</Heading>
          <Text style={text}>
            Use o código abaixo para confirmar sua identidade:
          </Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Text style={codeStyle}>{token}</Text>
          </Section>
          <Text style={footer}>
            Este código expira em alguns minutos. Se você não solicitou esta
            verificação, ignore este e-mail.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Open Sans', Arial, sans-serif",
  margin: 0,
  padding: '24px 0',
}
const container = { maxWidth: '560px', margin: '0 auto', padding: '0 16px' }
const header = {
  backgroundColor: '#0E1729',
  borderRadius: '12px 12px 0 0',
  padding: '20px 28px',
  textAlign: 'center' as const,
}
const brandMark = {
  color: '#E0A82E',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  letterSpacing: '3px',
  margin: 0,
}
const card = {
  backgroundColor: '#ffffff',
  border: '1px solid #E5E0D5',
  borderTop: 'none',
  borderRadius: '0 0 12px 12px',
  padding: '32px 28px',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#1a1a1a',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#3d3d3d',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const codeStyle = {
  display: 'inline-block',
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#0E1729',
  letterSpacing: '6px',
  backgroundColor: '#FAF6EC',
  border: '1px solid #E0A82E',
  borderRadius: '12px',
  padding: '16px 28px',
  margin: 0,
}
const footer = {
  fontSize: '12px',
  color: '#888888',
  margin: '24px 0 0',
  lineHeight: '1.5',
}
