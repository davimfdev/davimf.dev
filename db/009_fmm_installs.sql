-- ---------------------------------------------- instalações do FMM ---------
-- O nível gratuito do FMM não exige chave, então a API de licença nunca fica
-- sabendo que ele existe. Sem isso não há denominador: é impossível saber
-- quantas pessoas usam o app nem qual fração delas paga, e os limites do plano
-- FREE continuam sendo palpite.
--
-- Uma linha por instalação, identificada pelo hash de HWID que o app já calcula
-- para a licença. Não há nome, e-mail, IP, caminho de pasta nem nome de mod:
-- este arquivo é o contrato de privacidade do ping, junto com o texto exibido
-- em Configurações e o teste que trava o payload no lado do app.
CREATE TABLE IF NOT EXISTS fmm_installs (
  hwid_hash     text PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_version  text,
  last_level    text,
  ping_count    integer NOT NULL DEFAULT 1
);

-- Instalações ativas por período: a consulta natural é por last_seen_at.
CREATE INDEX IF NOT EXISTS fmm_installs_last_seen_idx
  ON fmm_installs(last_seen_at DESC);

-- O denominador de conversão sai daqui: quantos instalaram contra quantos
-- aparecem com nível pago.
CREATE INDEX IF NOT EXISTS fmm_installs_level_idx
  ON fmm_installs(last_level);
