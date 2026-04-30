/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu e-mail na {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brandMark}>SPENCER'S CARDTOPIA</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Confirme seu e-mail</Heading>
          <Text style={text}>
            Obrigado por criar sua conta na{' '}
            <Link href={siteUrl} style={link}>
              <strong>{siteName}</strong>
            </Link>
            !
          </Text>
          <Text style={text}>
            Para ativar o acesso de <strong>{recipient}</strong>, confirme seu
            endereço clicando no botão abaixo:
          </Text>
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button style={button} href={confirmationUrl}>
              Confirmar e-mail
            </Button>
          </Section>
          <Text style={footer}>
            Se você não criou esta conta, pode ignorar este e-mail com
            segurança.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
const link = { color: '#B8851F', textDecoration: 'underline' }
const button = {
  backgroundColor: '#E0A82E',
  color: '#0E1729',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = {
  fontSize: '12px',
  color: '#888888',
  margin: '24px 0 0',
  lineHeight: '1.5',
}
