/**
 * Campo de formulário do design system.
 *
 * Existem 23 arquivos com <input>, cada um reinventando rótulo, dica e erro —
 * e a associação rótulo↔controle costuma faltar, que é um bug de
 * acessibilidade real: sem ela, leitor de tela anuncia um campo sem nome.
 *
 * `children` é função porque o controle pode ser input, textarea ou um
 * componente de terceiro: o Field entrega os atributos e não impõe o elemento.
 * Rótulo, dica e erro são ReactNode — o site é PT/EN e quem chama traduz.
 *
 * O contrato tem uma folga conhecida: um callback que ignore `props` continua
 * compilando, e o campo perde silenciosamente id e aria. Não há tipo que
 * obrigue um callback a usar seu argumento. A falha aparece no teste de quem
 * chama — `getByLabelText` deixa de encontrar o controle —, e é ali que ela
 * deve ser pega.
 */

import { useId } from 'react';
import type { ReactNode } from 'react';

export type FieldControlProps = {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby'?: string;
};

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  id?: string;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
};

export function Field({ label, hint, error, id, className = '', children }: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const messageId = `${controlId}-message`;

  // O erro tem precedência sobre a dica: quando os dois existem, é o erro que
  // precisa ser anunciado.
  const message = error ?? hint;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      <label htmlFor={controlId} className="text-sm font-medium text-fg">
        {label}
      </label>

      {children({
        id: controlId,
        'aria-invalid': Boolean(error),
        'aria-describedby': message ? messageId : undefined,
      })}

      {message && (
        <span id={messageId} className={error ? 'text-sm text-danger' : 'text-sm text-fg-muted'}>
          {message}
        </span>
      )}
    </div>
  );
}
