/** Tests of the shared UI primitives. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ApiError, NetworkError } from '../api/errors';
import {
  Body, Button, Card, Chips, EmptyState, ErrorState, EstimateBadge, Field, KeyValue, Loading, Notice, PasswordField, Row, Screen, SectionTitle, Stat, Title,
} from './ui';

test('Button calls onPress and is disabled while loading', async () => {
  const onPress = jest.fn();
  await render(<Button title="Zapisz" icon="checkmark" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: /Zapisz/ }));
  expect(onPress).toHaveBeenCalledTimes(1);

  await render(<Button title="Zapisz" onPress={onPress} loading />);
  expect(screen.getByRole('button')).toBeDisabled();
});

test('Button variants render', async () => {
  for (const variant of ['primary', 'secondary', 'danger', 'ghost'] as const) {
    await render(<Button title={variant} variant={variant} onPress={jest.fn()} />);
    expect(screen.getByText(variant)).toBeOnTheScreen();
  }
});

test('Field shows label, error and hint', async () => {
  const onChange = jest.fn();
  await render(<Field label="Wartość" value="" onChangeText={onChange} error="Błąd pola" hint="Podpowiedź" />);

  await fireEvent.changeText(screen.getByLabelText('Wartość'), '12');
  expect(onChange).toHaveBeenCalledWith('12');
  expect(screen.getByText('Błąd pola')).toBeOnTheScreen();
  expect(screen.queryByText('Podpowiedź')).toBeNull();

  await render(<Field label="Inne" value="" hint="Podpowiedź" />);
  expect(screen.getByText('Podpowiedź')).toBeOnTheScreen();
});

test('Chips behave like a radio group', async () => {
  const onChange = jest.fn();
  await render(<Chips label="Taryfa" value="a" onChange={onChange} options={[{ value: 'a', label: 'G11' }, { value: 'b', label: 'G12' }]} />);

  expect(screen.getByRole('radio', { name: /G11/ })).toBeSelected();
  await fireEvent.press(screen.getByRole('radio', { name: /G12/ }));
  expect(onChange).toHaveBeenCalledWith('b');
});

test('Stat marks estimates with text, not only color', async () => {
  await render(<Stat label="Prognoza" value="100 zł" caption="brutto" estimate />);

  expect(screen.getByText('Dane szacunkowe')).toBeOnTheScreen();
  expect(screen.getByText('brutto')).toBeOnTheScreen();
});

test('ErrorState distinguishes offline errors and offers retry', async () => {
  const retry = jest.fn();
  await render(<ErrorState error={new NetworkError()} onRetry={retry} />);
  expect(screen.getByText('Brak połączenia')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: /Spróbuj ponownie/ }));
  expect(retry).toHaveBeenCalled();

  await render(<ErrorState error={new ApiError(500, 'Błąd serwera')} />);
  expect(screen.getByText('Nie udało się wczytać danych')).toBeOnTheScreen();
});

test('layout and text primitives render their content', async () => {
  await render(
    <Screen onRefresh={jest.fn()}>
      <Title>Tytuł</Title>
      <SectionTitle>Sekcja</SectionTitle>
      <Card><Body muted>Opis</Body></Card>
      <Row><KeyValue label="Klucz" value="Wartość" /></Row>
      <Notice tone="warning" title="Uwaga">Treść</Notice>
      <EstimateBadge label="Prognoza" />
      <EmptyState icon="list-outline" title="Pusto" description="Brak danych" action={<Text>Akcja</Text>} />
      <Loading label="Ładowanie" />
    </Screen>,
  );

  for (const text of ['Tytuł', 'Sekcja', 'Opis', 'Klucz', 'Wartość', 'Uwaga', 'Treść', 'Prognoza', 'Pusto', 'Akcja', 'Ładowanie']) {
    expect(screen.getByText(text)).toBeOnTheScreen();
  }
  expect(screen.getByRole('header', { name: 'Tytuł' })).toBeOnTheScreen();
});

test('Screen without scrolling renders children', async () => {
  await render(<Screen scroll={false}><Text>Treść</Text></Screen>);
  expect(screen.getByText('Treść')).toBeOnTheScreen();
});

describe('PasswordField', () => {
  test('hides the password by default and the eye button toggles it', async () => {
    const onChangeText = jest.fn();
    await render(<PasswordField label="Hasło" value="Tajne123" onChangeText={onChangeText} hint="Min. 10 znaków" />);

    const input = screen.getByLabelText('Hasło');
    expect(input).toHaveProp('secureTextEntry', true);
    expect(screen.getByText('Min. 10 znaków')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Pokaż hasło' }));
    expect(screen.getByLabelText('Hasło')).toHaveProp('secureTextEntry', false);

    await fireEvent.press(screen.getByRole('button', { name: 'Ukryj hasło' }));
    expect(screen.getByLabelText('Hasło')).toHaveProp('secureTextEntry', true);

    await fireEvent.changeText(screen.getByLabelText('Hasło'), 'Nowe');
    expect(onChangeText).toHaveBeenCalledWith('Nowe');
  });

  test('shows the error instead of the hint', async () => {
    await render(<PasswordField label="Hasło" value="" error="Za krótkie" hint="Min. 10 znaków" />);
    expect(screen.getByText('Za krótkie')).toBeOnTheScreen();
    expect(screen.queryByText('Min. 10 znaków')).toBeNull();
  });
});
