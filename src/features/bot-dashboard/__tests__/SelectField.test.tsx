// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SelectField, filterOptions, type SelectOption } from '../SelectField';

afterEach(cleanup);

const options: SelectOption[] = [
  { value: '', label: 'Não definido' },
  { value: '1', label: '#geral' },
  { value: '2', label: '#avisos' },
  { value: '3', label: '#logs' },
];

describe('filterOptions', () => {
  it('returns all options for an empty query', () => {
    expect(filterOptions(options, '')).toHaveLength(4);
  });
  it('filters case-insensitively by label', () => {
    expect(filterOptions(options, 'AVIS').map((o) => o.value)).toEqual(['2']);
  });
});

describe('SelectField', () => {
  it('opens the listbox and selects an option', () => {
    const onChange = vi.fn();
    render(<SelectField id="ch" value="" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('#avisos'));
    expect(onChange).toHaveBeenCalledWith('2');
  });
  it('filters options as you type', () => {
    render(<SelectField id="ch" value="" options={options} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'logs' } });
    expect(screen.queryByText('#geral')).toBeNull();
    expect(screen.getByText('#logs')).toBeTruthy();
  });

  it('closes the popover when Escape is pressed', () => {
    render(<SelectField id="ch" value="" options={options} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('combobox')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('closes the popover when clicking outside', () => {
    render(
      <div>
        <SelectField id="ch" value="" options={options} onChange={() => {}} />
      </div>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('combobox')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('selects an option via ArrowDown then Enter', () => {
    const onChange = vi.fn();
    render(<SelectField id="ch" value="" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('does not open when disabled', () => {
    render(<SelectField id="ch" value="" options={options} onChange={() => {}} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
