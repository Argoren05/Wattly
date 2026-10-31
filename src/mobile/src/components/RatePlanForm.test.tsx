/** Tests of the price list editor. */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { tariffG11, tariffG12 } from '../test/fixtures';
import { RatePlanForm } from './RatePlanForm';

async function renderForm(onSubmit = jest.fn(), tariff = tariffG12()) {
  await render(<RatePlanForm tariff={tariff} defaultValidFrom="2026-01-01" submitLabel="Zapisz stawki" onSubmit={onSubmit} />);
  return onSubmit;
}

test('submits only filled rows and converts VAT percent to fraction', async () => {
  const onSubmit = await renderForm();

  const rates = screen.getAllByLabelText(/Stawka netto/);
  await fireEvent.changeText(rates[0]!, '0,62');
  await fireEvent.changeText(rates[1]!, '0,41');
  await fireEvent.changeText(screen.getByLabelText('Źródło stawek'), 'Faktura FV/1');
  await fireEvent.press(screen.getByRole('button', { name: /Zapisz stawki/ }));

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    tariffId: 't12',
    validFrom: '2026-01-01',
    sourceReference: 'Faktura FV/1',
    components: [
      expect.objectContaining({ componentType: 'Energy', zoneCode: 'DAY', netRate: 0.62, taxRate: 0.23 }),
      expect.objectContaining({ componentType: 'Energy', zoneCode: 'NIGHT', netRate: 0.41, taxRate: 0.23 }),
    ],
  }));
});

test('requires source, at least one rate and valid numbers', async () => {
  const onSubmit = await renderForm(jest.fn(), tariffG11());
  const submit = () => fireEvent.press(screen.getByRole('button', { name: /Zapisz stawki/ }));

  await submit();
  expect(screen.getByText(/Wskaż źródło stawek/)).toBeOnTheScreen();

  await fireEvent.changeText(screen.getByLabelText('Źródło stawek'), 'Cennik');
  await submit();
  expect(screen.getByText('Uzupełnij co najmniej jedną stawkę.')).toBeOnTheScreen();

  await fireEvent.changeText(screen.getAllByLabelText(/Stawka netto/)[0]!, 'abc');
  await submit();
  expect(screen.getByText(/Nieprawidłowa stawka/)).toBeOnTheScreen();

  expect(onSubmit).not.toHaveBeenCalled();
});

test('rows can be removed and custom rows added', async () => {
  await renderForm(jest.fn(), tariffG11());
  const before = screen.getAllByLabelText(/Stawka netto/).length;

  await fireEvent.press(screen.getByRole('button', { name: 'Usuń Energia czynna' }));
  await fireEvent.press(screen.getByRole('button', { name: /Dodaj składnik/ }));
  await fireEvent.press(screen.getByRole('button', { name: /Dodaj opłatę miesięczną/ }));

  expect(screen.getAllByLabelText(/Stawka netto/)).toHaveLength(before + 1);
  expect(screen.getByDisplayValue('Inna opłata stała')).toBeOnTheScreen();
});
