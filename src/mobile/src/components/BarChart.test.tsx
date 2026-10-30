/** Tests of the accessible bar chart. */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { BarChart, type BarDatum } from './BarChart';

const data: BarDatum[] = [
  { key: 'a', label: '01.10', value: 5, estimate: false, description: '01.10: 5 kWh' },
  { key: 'b', label: '02.10', value: 10, estimate: true, description: '02.10: 10 kWh (estymacja)' },
];

test('shows the latest value, legend and range labels', async () => {
  await render(<BarChart data={data} unit="kWh" summary="Wykres zużycia" />);

  expect(screen.getByText('02.10: 10 kWh (estymacja)')).toBeOnTheScreen();
  expect(screen.getByText('Na podstawie odczytów')).toBeOnTheScreen();
  expect(screen.getByText('Estymacja')).toBeOnTheScreen();
  expect(screen.getByText('01.10')).toBeOnTheScreen();
  expect(screen.getByLabelText('Wykres zużycia')).toBeOnTheScreen();
});

test('selecting a bar reads out its exact value', async () => {
  await render(<BarChart data={data} unit="kWh" summary="Wykres" />);

  await fireEvent.press(screen.getByRole('button', { name: '01.10: 5 kWh' }));

  expect(screen.getByText('01.10: 5 kWh')).toBeOnTheScreen();
});

test('empty chart says there is no data and draws bars after layout', async () => {
  await render(<BarChart data={[]} unit="kWh" summary="Pusty" />);
  expect(screen.getByText('Brak danych')).toBeOnTheScreen();

  await render(<BarChart data={data} unit="kWh" summary="Wykres" height={100} />);
  const chartArea = screen.getByLabelText('Wykres').children[1] as never;
  await fireEvent(chartArea, 'layout', { nativeEvent: { layout: { width: 300, height: 100 } } });
  expect(screen.getByText(/maks\./)).toBeOnTheScreen();
});
