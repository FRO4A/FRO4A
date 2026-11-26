import { Address, beginCell, Cell, contractAddress } from '@ton/core';
import type { GameType, QuotaView } from '../types/game';
import { sameAddress } from '../utils/address';
import { runGetter, stackNumber } from './tonapi';

/**
 * Code cells copied verbatim from the compiled Tact wrappers:
 *   shared/wrappers/ball/UserQuota.compiled.json
 *     hash 0c048f2201a9aaf4596991f489cd67a9dae12454b25360208aab767bbcef195b
 *   shared/wrappers/100k/user_quota.compiled.json
 *     hash 08318e2fb1ba6ba54d66d306718cfd1f6845efd0b46e7d51f2ba53fe39052e85
 *
 * They are used only to derive the deterministic UserQuota address
 * `contractAddress(initOf UserQuota(draw, owner))`; the quota itself is always
 * read from the chain with `getQuotaInfo`.
 */
const BALL_QUOTA_CODE_HEX =
  'b5ee9c7241020f01000262000228ff008e88f4a413f4bcf2c80bed5320e303ed43d901090202710204014bbec87f6a268690000ce7d207d206987e99faa98360a4d7d207d202c816880b810716d9e3622c03000c5473218064240201620507014bb3a27b5134348000673e903e9034c3f4cfd54c1b0526be903e901640b4405c0838b6cf1b106006000222014bb11a3b5134348000673e903e9034c3f4cfd54c1b0526be903e901640b4405c0838b6cf1b10600800022102f63001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019cfa40fa40d30fd33f55306c149afa40fa405902d1017020e205925f05e003d70d1ff2e08221811002bae30221811006ba8e285b82009615f84223c705f2f422c2009302a502de4003c87f01ca0055305034cececb0fcb3fc9ed54e0010a0c01ea313403d33fd33f30f84223c705f2e47d8200b8e124c164f2f403a4238208b71b0051367007c855208110035004cb1f12cb3fcecb3fc924441350667050346d036d5520c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0043300b0024c87f01ca0055305034cececb0fcb3fc9ed540116811007bae3025f05f2c0820d01f6d33f31fa00308200ed16f84224c705f2f4f8276f108208e4e1c0a15cbc91319130e220c2008ebd73708824553010246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb009130e24003c87f01ca0055305034cececb0fcb3fc9ed540e003c0000000046524f34412042616c6c20707572636861736520726566756e64646748f6';

const HUNDRED_K_QUOTA_CODE_HEX =
  'b5ee9c7241020801000193000114ff00f4a413f4bcf2c80b01020162020601b8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e17fa40fa40810101d700d401d0810101d700301443306c149bfa40fa405902d101708064e205925f05e003d70d1ff2e08230815001bae3025f04f2c0820302a4813b92f84223c705f2f45323be8ea0400370db3cc87f01ca0055305034cece810101cf0001c8810101cf00cdc9ed54e002a450037fdb3cc87f01ca0055305034cece810101cf0001c8810101cf00cdc9ed54040401ecf8416f24135f03f8276f1021a1708208b71b0058a1b60982085b8d80a0a120c100923070de8208b71b0070fb02019b23c80181510158cb1fcec99b23c80181510258cb1fcec9e2722643137044306d036d4313c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf818ae2f400c901fb0005001a58cf8680cf8480f400f400cf810165a0b21fda89a1a400031c2ff481f481020203ae01a803a1020203ae0060288660d82937f481f480b205a202e100c9c5b678d88b070018705312a1b6095464405464402d746574';

function quotaCode(gameType: GameType): Cell {
  const hex = gameType === 'BALL' ? BALL_QUOTA_CODE_HEX : HUNDRED_K_QUOTA_CODE_HEX;
  return Cell.fromBoc(Buffer.from(hex, 'hex'))[0];
}

/**
 * Deterministic UserQuota address:
 *   data = 0:1 (Tact init flag) | drawAddress | ownerAddress
 * All other fields are Tact defaults and are not stored in the state init.
 * Verified against the on-chain `getUserQuotaAddress` getter for both games.
 */
export function userQuotaAddress(gameType: GameType, drawAddress: string, ownerAddress: string): string {
  const draw = Address.parse(drawAddress);
  const owner = Address.parse(ownerAddress);
  const data = beginCell().storeUint(0, 1).storeAddress(draw).storeAddress(owner).endCell();
  const address = contractAddress(0, { code: quotaCode(gameType), data });
  return address.toString({ bounceable: true });
}

export async function readUserQuota(
  gameType: GameType,
  drawAddress: string,
  ownerAddress: string,
  signal?: AbortSignal,
): Promise<QuotaView> {
  let quotaAddress: string | null = null;
  try {
    quotaAddress = userQuotaAddress(gameType, drawAddress, ownerAddress);
  } catch {
    return { count: 0, max: 100, address: null };
  }
  try {
    const result = await runGetter(quotaAddress, 'getQuotaInfo', signal);
    if (result.exitCode !== 0) return { count: 0, max: 100, address: quotaAddress };
    const count = Number(stackNumber(result.stack[2]) ?? 0n);
    const max = Number(stackNumber(result.stack[3]) ?? 100n);
    return { count, max: max > 0 ? max : 100, address: quotaAddress };
  } catch {
    // A quota contract only exists after the wallet's first purchase.
    return { count: 0, max: 100, address: quotaAddress };
  }
}

export function sameDraw(left: string, right: string): boolean {
  return sameAddress(left, right);
}

