// Shared validation for the sender/from domains used by the email queue.
// A misconfigured domain (e.g. missing the ".br" suffix) makes the email API
// reject every send with 403 "no_matching_sender", so we fail fast instead.

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(\.[a-z]{2,})?$/

export interface DomainValidationResult {
  valid: boolean
  errors: string[]
  senderDomain: string
  fromDomain: string
}

export function validateEmailDomains(
  senderDomain: string | undefined,
  fromDomain: string | undefined,
): DomainValidationResult {
  const sender = (senderDomain ?? '').trim().toLowerCase()
  const from = (fromDomain ?? '').trim().toLowerCase()
  const errors: string[] = []

  if (!sender) {
    errors.push('SENDER_DOMAIN não configurado')
  } else if (!DOMAIN_RE.test(sender)) {
    errors.push(`SENDER_DOMAIN inválido: "${sender}"`)
  } else if (sender.split('.').length < 3) {
    errors.push(
      `SENDER_DOMAIN deve ser o subdomínio verificado (ex.: notify.exemplo.com.br), recebido "${sender}"`,
    )
  }

  if (!from) {
    errors.push('FROM_DOMAIN não configurado')
  } else if (!DOMAIN_RE.test(from)) {
    errors.push(`FROM_DOMAIN inválido: "${from}"`)
  }

  // The visible From domain must belong to the same registrable domain as the
  // verified sender subdomain. This catches truncated suffixes such as
  // "spencerscardtopia.com" vs "notify.spencerscardtopia.com.br".
  if (sender && from && !errors.length) {
    const aligned = sender === from || sender.endsWith(`.${from}`)
    if (!aligned) {
      errors.push(
        `FROM_DOMAIN "${from}" não corresponde ao domínio verificado "${sender}" (verifique sufixos como .br)`,
      )
    }
  }

  return { valid: errors.length === 0, errors, senderDomain: sender, fromDomain: from }
}
