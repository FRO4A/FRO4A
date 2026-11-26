import { Address, beginCell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import { stackAddress, stackCell, stackNumber } from '../services/tonapi';

describe('TonAPI stack parsing', () => {
  it('reads hex-encoded cell BOCs (public testnet format) and addresses', () => {
    const address = Address.parse('EQDeLewjWId6lshlusHxHXvJTlG2dM_tXdyKzqzW5SsiBs5d');
    const cell = beginCell().storeAddress(address).endCell();
    const hex = cell.toBoc().toString('hex');
    expect(stackCell({ type: 'cell', cell: hex })?.hash().toString('hex')).toBe(cell.hash().toString('hex'));
    expect(stackAddress({ type: 'cell', cell: hex })?.toString()).toBe(address.toString());
  });

  it('reads base64-encoded cell BOCs', () => {
    const cell = beginCell().storeUint(42, 64).endCell();
    const base64 = cell.toBoc().toString('base64');
    const parsed = stackCell({ type: 'cell', cell: base64 });
    expect(parsed?.beginParse().loadUintBig(64)).toBe(42n);
    expect(stackNumber({ type: 'cell', cell: base64 })).toBe(42n);
  });

  it('reads decimal and hex numbers and ignores null', () => {
    expect(stackNumber({ type: 'num', num: '12345' })).toBe(12345n);
    expect(stackNumber({ type: 'num', num: '0xff' })).toBe(255n);
    expect(stackNumber({ type: 'null' })).toBeNull();
    expect(stackCell({ type: 'null' })).toBeNull();
    expect(stackAddress({ type: 'null' })).toBeNull();
  });

  it('parses the live getUserQuotaAddress result format', () => {
    const hex =
      'b5ee9c72010101010024000043800a17bf1261047fb67f61cfc2a8f7895a1dc983cb036ccbc1872b1556c1afa19df0';
    expect(stackAddress({ type: 'cell', cell: hex })?.toString()).toBe(
      'EQBQvfiTCCP9s_sOfhVHvErQ7kweWBtmXgw5WKq2DX0M7xdc',
    );
  });
});
