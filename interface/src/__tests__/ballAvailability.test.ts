import { Address, beginCell } from '@ton/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkBallCombinationOnChain, decideSelectionStatus } from '../services/ballAvailability';

const DRAW = 'EQCN7Hi07_sP5QmsM0Lz_c4tORZOJBWzZ_hZAyQihHv3pGjt';
const WALLET = '0:936b7e9cf0de368b569d2f6330942847e09390333fecdeb19eda9ddd85873e8b';
const TICKET = '0:bd74c202c416a81671c8fe93f181a1793544c22c62878d1504a21e0bbeaeda02';

function cell(type: string, value: string): { type: string; cell: string } {
  return { type, cell: value };
}

const addressCell = beginCell().storeAddress(Address.parse(TICKET)).endCell().toBoc().toString('hex');
const ownerCell = beginCell().storeAddress(Address.parse(WALLET)).endCell().toBoc().toString('hex');

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function mockApi(options: { account: 'active' | 'missing'; owner: 'wallet' | 'none' | 'getter-fails' }) {
  vi.stubGlobal('fetch', (input: string | URL) => {
    const url = String(input);
    if (url.includes('/methods/getTicketAddress')) {
      return Promise.resolve(
        respond({ success: true, exit_code: 0, stack: [cell('cell', addressCell)] }),
      );
    }
    if (url.includes('/methods/getTicketInfo')) {
      if (options.owner === 'getter-fails') {
        return Promise.resolve(respond({ success: false, exit_code: 11, stack: [] }));
      }
      return Promise.resolve(
        respond({
          success: true,
          exit_code: 0,
          stack: [
            cell('cell', addressCell),
            options.owner === 'wallet' ? cell('cell', ownerCell) : { type: 'null' },
          ],
        }),
      );
    }
    if (url.includes('/blockchain/accounts/')) {
      if (options.account === 'missing') {
        return Promise.resolve(respond({ error: 'entity not found' }, 404));
      }
      return Promise.resolve(respond({ status: 'active', balance: 1 }));
    }
    return Promise.resolve(respond({ error: 'unexpected' }, 500));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('live on-chain BALL availability', () => {
  it('treats a never-minted SBT (HTTP 404) as an available combination', async () => {
    mockApi({ account: 'missing', owner: 'none' });
    const result = await checkBallCombinationOnChain(DRAW, 42n);
    expect(result.status).toBe('available');
    expect(result.ticketAddress).not.toBeNull();
  });

  it('treats an active SBT with an owner as taken', async () => {
    mockApi({ account: 'active', owner: 'wallet' });
    expect((await checkBallCombinationOnChain(DRAW, 42n)).status).toBe('taken');
  });

  it('treats an active SBT without an owner as available', async () => {
    mockApi({ account: 'active', owner: 'none' });
    expect((await checkBallCombinationOnChain(DRAW, 42n)).status).toBe('available');
  });

  it('reports unknown when the ticket getter fails, so the UI stays locked', async () => {
    mockApi({ account: 'active', owner: 'getter-fails' });
    expect((await checkBallCombinationOnChain(DRAW, 42n)).status).toBe('unknown');
  });

  it('reports unknown when TonAPI is unreachable', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('network down')));
    expect((await checkBallCombinationOnChain(DRAW, 42n)).status).toBe('unknown');
  });
});

describe('selection availability decision (0 ms, server Set only)', () => {
  it('marks taken in every duplicate case and otherwise marks available instantly', () => {
    expect(decideSelectionStatus({ complete: false, inBasket: false, serverTaken: false })).toBe('idle');
    expect(decideSelectionStatus({ complete: true, inBasket: false, serverTaken: true })).toBe('taken');
    expect(decideSelectionStatus({ complete: true, inBasket: true, serverTaken: false })).toBe('taken');
    expect(decideSelectionStatus({ complete: true, inBasket: false, serverTaken: false })).toBe('available');
  });
});
