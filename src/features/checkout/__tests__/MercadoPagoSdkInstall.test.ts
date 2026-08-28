import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('instalação do MercadoPago.js V2', () => {
  it('segue o snippet oficial no body sem carregamento assíncrono', () => {
    const html = readFileSync('index.html', 'utf8');
    const body = html.slice(html.indexOf('<body>'), html.indexOf('</body>'));

    expect(body).toContain('<script id="mercadopago-sdk-v2" src="https://sdk.mercadopago.com/js/v2"></script>');
    expect(body).not.toMatch(/mercadopago-sdk-v2[^>]*\basync\b/);
  });
});
