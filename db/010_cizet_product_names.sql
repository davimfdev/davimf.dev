-- Cizet é a marca; códigos, preços e identificadores FMM continuam iguais.
-- Execute após 005_payments.sql. Pode ser reaplicada sem alterar outros dados.
-- orders.metadata.productName guarda o nome na compra: não atualizar pedidos.
-- Algumas telas/e-mails consultam o catálogo atual e podem exibir Cizet também
-- para pedidos antigos; esta migração preserva o snapshot original no metadata.
BEGIN;

UPDATE products AS product
SET name = renamed.name
FROM (VALUES
  ('fmm-basic-monthly',   'Cizet Básico - Mensal'),
  ('fmm-basic-quarterly', 'Cizet Básico - Trimestral'),
  ('fmm-basic-lifetime',  'Cizet Básico - Vitalício'),
  ('fmm-pro-monthly',     'Cizet Pro - Mensal'),
  ('fmm-pro-quarterly',   'Cizet Pro - Trimestral'),
  ('fmm-pro-lifetime',    'Cizet Pro - Vitalício')
) AS renamed(code, name)
WHERE product.code = renamed.code
  AND product.family = 'fmm'
  AND product.name IS DISTINCT FROM renamed.name;

COMMIT;
