// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Field } from '../Field';

afterEach(cleanup);

describe('Field', () => {
  it('associa o rótulo ao controle pelo id gerado', () => {
    render(
      <Field label="CPF">
        {(props) => <input {...props} />}
      </Field>,
    );
    // getByLabelText só encontra se a associação label↔controle existir.
    const input = screen.getByLabelText('CPF');
    expect(input.tagName).toBe('INPUT');
  });

  it('respeita um id explícito quando informado', () => {
    render(
      <Field label="E-mail" id="email-cobranca">
        {(props) => <input {...props} />}
      </Field>,
    );
    expect(screen.getByLabelText('E-mail').getAttribute('id')).toBe('email-cobranca');
  });

  it('sem erro, o controle não é aria-invalid', () => {
    render(<Field label="CPF">{(props) => <input {...props} />}</Field>);
    expect(screen.getByLabelText('CPF').getAttribute('aria-invalid')).toBe('false');
  });

  it('com erro, marca aria-invalid e descreve o controle pela mensagem', () => {
    render(
      <Field label="CPF" error="CPF inválido">
        {(props) => <input {...props} />}
      </Field>,
    );
    const input = screen.getByLabelText('CPF');
    expect(input.getAttribute('aria-invalid')).toBe('true');

    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy as string)?.textContent).toBe('CPF inválido');
  });

  it('a dica também descreve o controle', () => {
    render(
      <Field label="CPF" hint="Somente números">
        {(props) => <input {...props} />}
      </Field>,
    );
    const describedBy = screen.getByLabelText('CPF').getAttribute('aria-describedby');
    expect(document.getElementById(describedBy as string)?.textContent).toBe('Somente números');
  });

  /** Rótulo e erro são ReactNode, não string: quem chama traduz. */
  it('aceita rótulo e erro como elementos, não só texto', () => {
    render(
      <Field label={<span>Documento</span>} error={<em>obrigatório</em>}>
        {(props) => <input {...props} />}
      </Field>,
    );
    expect(screen.getByLabelText('Documento')).toBeDefined();
    expect(screen.getByText('obrigatório').tagName).toBe('EM');
  });
});
