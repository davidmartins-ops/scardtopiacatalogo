/**
 * Validações obrigatórias do checkout — evitam pedidos que derrubam a emissão
 * da etiqueta (CEP/número/CPF incompletos ou inválidos).
 */

export const onlyDigits = (v: string) => (v ?? "").replace(/\D/g, "");

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function isValidPhone(value: string): boolean {
  const d = onlyDigits(value);
  return d.length === 10 || d.length === 11;
}

export function isValidCep(value: string): boolean {
  return onlyDigits(value).length === 8;
}

export interface CheckoutValidationInput {
  cpf: string;
  phone: string;
  deliveryMethod: "pickup" | "shipping" | null;
  cepFound?: boolean;
  address?: {
    cep: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  shippingServiceSelected?: boolean;
}

/** Retorna a lista de problemas (vazia = pode seguir). */
export function validateCheckout(input: CheckoutValidationInput): string[] {
  const issues: string[] = [];

  if (!input.cpf.trim()) issues.push("Informe o CPF do titular do pedido.");
  else if (!isValidCpf(input.cpf)) issues.push("CPF inválido — confira os números digitados.");

  if (!input.phone.trim()) issues.push("Informe um telefone de contato.");
  else if (!isValidPhone(input.phone)) issues.push("Telefone inválido — use DDD + número.");

  if (input.deliveryMethod === "shipping") {
    const a = input.address;
    if (!a || !isValidCep(a.cep)) issues.push("CEP inválido — precisa ter 8 dígitos.");
    else if (input.cepFound === false) issues.push("CEP não encontrado nos Correios. Revise o CEP informado.");
    if (!a?.street?.trim()) issues.push("Informe a rua / logradouro.");
    if (!a?.number?.trim()) issues.push("Informe o número do endereço (obrigatório para a etiqueta).");
    if (!a?.neighborhood?.trim()) issues.push("Informe o bairro.");
    if (!a?.city?.trim()) issues.push("Informe a cidade.");
    if (!a?.state?.trim() || a.state.trim().length !== 2) issues.push("Informe o estado (UF) com 2 letras.");
    if (input.shippingServiceSelected === false) issues.push("Escolha a forma de envio (serviço de frete).");
  }

  return issues;
}
