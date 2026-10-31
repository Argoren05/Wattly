/** Verifies that every endpoint function calls the right HTTP method and path. */
import { http } from './client';
import { analyticsApi, appApi, authApi, catalogApi, invoiceApi, meterApi, propertyApi, readingApi } from './endpoints';

jest.mock('./client', () => ({
  http: { get: jest.fn(async () => 'ok'), post: jest.fn(async () => 'ok'), put: jest.fn(async () => 'ok'), delete: jest.fn(async () => undefined) },
}));

const cases: [string, () => Promise<unknown>, keyof typeof http, string, unknown?][] = [
  ['register', () => authApi.register('a@b.c', 'p'), 'post', '/auth/register', { email: 'a@b.c', password: 'p' }],
  ['login', () => authApi.login('a@b.c', 'p'), 'post', '/auth/login', { email: 'a@b.c', password: 'p' }],
  ['logout', () => authApi.logout(), 'post', '/auth/logout'],
  ['forgot', () => authApi.forgotPassword('a@b.c'), 'post', '/auth/forgotPassword', { email: 'a@b.c' }],
  ['me', () => authApi.me(), 'get', '/users/me'],
  ['operators', () => catalogApi.operators(), 'get', '/catalog/operators'],
  ['suppliers', () => catalogApi.suppliers(), 'get', '/catalog/suppliers'],
  ['tariffs', () => catalogApi.tariffs(), 'get', '/catalog/tariffs'],
  ['properties', () => propertyApi.list(), 'get', '/properties'],
  ['property', () => propertyApi.get('p1'), 'get', '/properties/p1'],
  ['create property', () => propertyApi.create({ name: 'x' }), 'post', '/properties', { name: 'x' }],
  ['update property', () => propertyApi.update('p1', { name: 'x' }), 'put', '/properties/p1', { name: 'x' }],
  ['delete property', () => propertyApi.remove('p1'), 'delete', '/properties/p1'],
  ['contract', () => propertyApi.contract('p1'), 'get', '/properties/p1/energy-contract'],
  ['rate plans', () => propertyApi.ratePlans('p1'), 'get', '/properties/p1/rate-plans'],
  ['end plan', () => propertyApi.endRatePlan('rp', '2026-01-31'), 'post', '/rate-plans/rp/end', { validTo: '2026-01-31' }],
  ['meters', () => meterApi.list('p1'), 'get', '/properties/p1/meters'],
  ['readings', () => readingApi.list('r1', 2, true), 'get', '/registers/r1/readings?page=2&pageSize=50&includeInactive=true'],
  ['reading', () => readingApi.get('x'), 'get', '/readings/x'],
  ['void', () => readingApi.void('x', 'pomyłka'), 'post', '/readings/x/void', { reason: 'pomyłka' }],
  ['forecast', () => analyticsApi.forecast('p1'), 'get', '/properties/p1/forecast'],
  ['consumption', () => analyticsApi.consumption('p1', '2026-01-01', '2026-01-31', 'Day'), 'get', '/properties/p1/analytics/consumption?from=2026-01-01&to=2026-01-31&granularity=Day'],
  ['costs', () => analyticsApi.costs('p1', 'a', 'b', 'Month'), 'get', '/properties/p1/analytics/costs?from=a&to=b&granularity=Month'],
  ['preview', () => analyticsApi.preview('p1', 'a', 'b'), 'post', '/properties/p1/calculations/preview', { from: 'a', to: 'b' }],
  ['invoices', () => invoiceApi.list('p1'), 'get', '/properties/p1/invoices'],
  ['invoice', () => invoiceApi.get('i1'), 'get', '/invoices/i1'],
  ['delete invoice', () => invoiceApi.remove('i1'), 'delete', '/invoices/i1'],
  ['release', () => appApi.release('android', '1.0.0'), 'get', '/app/release?platform=android&version=1.0.0'],
];

const rows = cases.map(([name, call, method, path, body]) => ({ name, call, method, path, body }));

test.each(rows)('$name', async ({ call, method, path, body }) => {
  await call();

  const mock = jest.mocked(http[method]);
  expect(mock).toHaveBeenCalledTimes(1);
  expect(mock.mock.calls[0]?.[0]).toBe(path);
  if (body !== undefined) expect((mock.mock.calls[0] as unknown[])[1]).toEqual(body);
});

test('mutations with bodies pass them through', async () => {
  await propertyApi.setContract('p1', { tariffId: 't', supplierId: null, operatorId: null, contractedPowerKw: null, validFrom: 'd', validTo: null });
  await propertyApi.createRatePlan('p1', { tariffId: 't', name: 'n', validFrom: 'd', sourceReference: 's', components: [] });
  await meterApi.create('p1', { name: 'm', meterType: 'Conventional', directionality: 'ImportOnly' });
  await readingApi.create('r1', { readingAt: 'd', value: 1 });
  await readingApi.correct('x', { readingAt: 'd', value: 2 });
  await invoiceApi.create('p1', { invoiceNumber: '1', issueDate: 'd', periodStart: 'd', periodEnd: 'd', totalGross: 1 });
  await invoiceApi.attach('i1', new FormData());

  expect(jest.mocked(http.put).mock.calls.map((c) => c[0])).toEqual(['/properties/p1/energy-contract', '/readings/x']);
  expect(jest.mocked(http.post).mock.calls.map((c) => c[0])).toEqual([
    '/properties/p1/rate-plans', '/properties/p1/meters', '/registers/r1/readings', '/properties/p1/invoices', '/invoices/i1/attachments',
  ]);
});
