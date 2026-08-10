/**
 * Traduz erros do banco em mensagens claras para o cliente no carrinho/checkout.
 */
export const CREDIT_DROP_LIMIT_MESSAGE =
  "Nos drops, os créditos da loja cobrem no máximo 50% do valor dos drops do pedido. " +
  "Reduza o valor em créditos (ou remova drops do carrinho) e pague o restante por PIX, cartão ou boleto.";

export function friendlyOrderError(error: unknown, fallback = "Erro inesperado ao registrar pedido. Tente novamente."): string {
  const raw =
    typeof error === "string"
      ? error
      : (error as { message?: string } | null | undefined)?.message ?? "";

  if (/Cr[ée]ditos acima do limite permitido/i.test(raw)) {
    const max = raw.match(/m[áa]ximo R\$\s*([\d.,]+)/i)?.[1];
    return max
      ? `${CREDIT_DROP_LIMIT_MESSAGE} Máximo permitido neste pedido: R$ ${max}.`
      : CREDIT_DROP_LIMIT_MESSAGE;
  }
  if (/Saldo de cr[ée]dito insuficiente/i.test(raw)) {
    return "Seu saldo de créditos é insuficiente para o valor solicitado. Atualize a página e tente novamente.";
  }
  return raw || fallback;
}
