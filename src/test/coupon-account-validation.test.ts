import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";

const customer = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const db = new PGlite();
const lines = JSON.stringify([{ category: "Secret Lair", product_type: "drop", amount: 1400, discount: 0 }]);
const evaluate = (user: string | null = customer, cpf = "", method = "pix", discount = 0) =>
  db.query<{ discount: string }>("SELECT * FROM public.evaluate_coupon('SCARDTOPIA', $1::uuid, $2, $3::jsonb, 'catalog', false, $4)",
    [user, cpf, discount ? JSON.stringify([{ category: "Secret Lair", product_type: "drop", amount: 1400, discount }]) : lines, method]);

beforeAll(async () => {
  await db.exec(`CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid, email text);
    CREATE TABLE public.customer_profiles (id uuid, cpf text);
    CREATE TABLE public.coupons (id uuid, code text, is_active boolean, starts_at timestamptz, expires_at timestamptz,
      applies_to_catalog boolean, applies_to_special_orders boolean, max_uses int, uses_count int, blocked_cpfs text[],
      blocked_emails text[], per_cpf_limit int, applies_to_product_type text, allow_on_promotional boolean,
      blocked_categories text[], allowed_categories text[], min_purchase numeric, discount_type text, discount_value numeric, max_discount numeric);
    CREATE TABLE public.coupon_redemptions (coupon_id uuid, user_id uuid, cpf text);
    INSERT INTO auth.users VALUES ('${customer}', 'customer@example.test'), ('${other}', 'other@example.test');
    INSERT INTO public.customer_profiles VALUES ('${customer}', NULL);
    INSERT INTO public.coupons VALUES ('00000000-0000-0000-0000-000000000010', 'SCARDTOPIA', true, NULL, NULL,
      true, true, NULL, 0, '{}', '{}', 1, 'all', false, '{}', '{}', 400, 'percent', 15, 300);`);
  const original = readFileSync("drizzle/migrations/0010_coupon_promotional_rule.sql", "utf8");
  const start = original.indexOf("CREATE OR REPLACE FUNCTION public.evaluate_coupon(");
  const end = original.indexOf("$function$;", start) + "$function$;".length;
  await db.exec(original.slice(start, end));
  await db.exec(readFileSync("drizzle/migrations/0012_coupon_authenticated_customer_identity.sql", "utf8"));
}, 30_000);
afterAll(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec("DELETE FROM coupon_redemptions; UPDATE customer_profiles SET cpf = NULL; UPDATE coupons SET blocked_cpfs = '{}', blocked_emails = '{}';");
});

describe("server coupon validation by logged-in customer", () => {
  it("applies SCARDTOPIA without CPF to the logged-in customer's R$1400 purchase", async () => {
    expect(Number((await evaluate()).rows[0].discount)).toBe(210);
  });
  it("still requires login", async () => {
    await expect(evaluate(null)).rejects.toThrow("Faça login");
  });
  it("retains the one-use limit for the same account without CPF", async () => {
    await db.query("INSERT INTO coupon_redemptions VALUES ('00000000-0000-0000-0000-000000000010', $1, '')", [customer]);
    await expect(evaluate()).rejects.toThrow("Limite de uso");
  });
  it("does not count another customer's empty CPF as this account's redemption", async () => {
    await db.query("INSERT INTO coupon_redemptions VALUES ('00000000-0000-0000-0000-000000000010', $1, '')", [other]);
    expect(Number((await evaluate()).rows[0].discount)).toBe(210);
  });
  it("still blocks a saved CPF even when a different CPF is supplied", async () => {
    await db.exec("UPDATE customer_profiles SET cpf = '52998224725'; UPDATE coupons SET blocked_cpfs = ARRAY['52998224725'];");
    await expect(evaluate(customer, '11144477735')).rejects.toThrow("indisponível");
  });
  it("still blocks customer email without CPF", async () => {
    await db.exec("UPDATE coupons SET blocked_emails = ARRAY['customer@example.test'];");
    await expect(evaluate()).rejects.toThrow("indisponível");
  });
  it("still counts usage by saved CPF across accounts", async () => {
    await db.exec("UPDATE customer_profiles SET cpf = '52998224725';");
    await db.query("INSERT INTO coupon_redemptions VALUES ('00000000-0000-0000-0000-000000000010', $1, '52998224725')", [other]);
    await expect(evaluate()).rejects.toThrow("Limite de uso");
  });
  it("keeps the R$300 SCARDTOPIA cap", async () => {
    const result = await db.query<{ discount: string }>("SELECT * FROM evaluate_coupon('SCARDTOPIA', $1::uuid, '', $2::jsonb, 'catalog', false, 'pix')", [customer, JSON.stringify([{ product_type: 'drop', amount: 4000 }])]);
    expect(Number(result.rows[0].discount)).toBe(300);
  });
  it("still excludes promotional items on PIX", async () => {
    await expect(evaluate(customer, '', 'pix', 20)).rejects.toThrow("Nenhum item");
  });
  it("still allows promotional items on card", async () => {
    expect(Number((await evaluate(customer, '', 'credit', 20)).rows[0].discount)).toBe(210);
  });
});