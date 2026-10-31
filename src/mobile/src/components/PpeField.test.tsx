import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { CameraView } from 'expo-camera';
import { useState } from 'react';

import { PpeField, ppeError } from './PpeField';

/** Field with its own state, as used in forms. */
function Harness() {
  const [value, setValue] = useState('');
  return <PpeField value={value} onChange={setValue} />;
}

test('ppeError accepts empty and valid numbers', () => {
  expect(ppeError('')).toBeNull();
  expect(ppeError('5903 2242 8100 789765')).toBeNull();
  expect(ppeError('590322428100789766')).toMatch(/cyfrę kontrolną/);
});

test('shows the check-digit error while typing and opens the scanner', async () => {
  await render(<Harness />);
  await fireEvent.changeText(screen.getByLabelText('Numer PPE (opcjonalnie)'), '59032242810078976');
  expect(screen.getByText(/18 cyfr i cyfrę kontrolną/)).toBeOnTheScreen();

  await fireEvent.changeText(screen.getByLabelText('Numer PPE (opcjonalnie)'), '590322428100789765');
  expect(screen.queryByText(/cyfrę kontrolną/)).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: /Skanuj kod PPE/ }));
  expect(await screen.findByText(/Skieruj aparat na kod kreskowy/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: /Anuluj/ }));
  expect(screen.queryByText(/Skieruj aparat/)).toBeNull();
});

test('a scanned GS1 barcode fills the field; other codes show a hint', async () => {
  await render(<Harness />);
  await fireEvent.press(screen.getByRole('button', { name: /Skanuj kod PPE/ }));
  const scan = (data: string) => act(() => {
    const props = jest.mocked(CameraView).mock.calls.at(-1)![0] as { onBarcodeScanned: (r: { type: string; data: string }) => void };
    props.onBarcodeScanned({ type: 'code128', data });
  });

  await scan('26931897');
  expect(screen.getByText(/Ten kod nie zawiera numeru PPE/)).toBeOnTheScreen();

  await scan('(8018)590322428100789765');
  expect(screen.queryByText(/Skieruj aparat|Ten kod nie zawiera/)).toBeNull();
  expect(screen.getByDisplayValue('590322428100789765')).toBeOnTheScreen();
});
