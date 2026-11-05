import { base64Decode, utf8Decode, utf8Encode } from './bytes';

test('UTF-8 round trip with Polish letters and emoji', () => {
  const text = 'Gniazdko – pralka zażółć 🔌';
  expect(Array.from(utf8Encode(text))).toEqual(Array.from(Buffer.from(text, 'utf8')));
  expect(utf8Decode(utf8Encode(text))).toBe(text);
  expect(utf8Decode(Uint8Array.from([0x61, 0xff, 0x62]))).toBe('a�b');
  expect(utf8Decode(Uint8Array.from([0xc5]))).toBe('�');
});

test('base64 decodes Tapo nicknames', () => {
  const nickname = Buffer.from('Pralka łazienka', 'utf8').toString('base64');
  expect(utf8Decode(base64Decode(nickname))).toBe('Pralka łazienka');
  expect(utf8Decode(base64Decode('YWJj\n'))).toBe('abc');
});
