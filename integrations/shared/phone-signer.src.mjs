import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { bindData } from "./bind-types.mjs";
const STORAGE_KEY = "funcaster.web3.key";
let account;
export function loadOrCreateKey(storage = globalThis.localStorage) {
  if (account) return account.address;
  const saved = storage.getItem(STORAGE_KEY);
  // Do not silently rotate a corrupt/lost persistent key; the player stays a guest.
  if (saved) {
    account = privateKeyToAccount(saved);
    return account.address;
  }
  const key = generatePrivateKey();
  storage.setItem(STORAGE_KEY, key);
  account = privateKeyToAccount(key);
  return account.address;
}
export function address() {
  return account?.address ?? null;
}
export function signTyped(data) {
  if (!account) throw new Error("Session identity unavailable");
  return account.signTypedData(data);
}
export async function signBind(challenge, seat) {
  if (
    !challenge ||
    !/^0x[\da-f]{64}$/i.test(challenge.nonce) ||
    !Number.isSafeInteger(challenge.expiresAt) ||
    challenge.domain?.name !== "Funcaster Console" ||
    challenge.domain?.version !== "1" ||
    !Number.isSafeInteger(challenge.domain?.chainId) ||
    !/^0x[\da-f]{64}$/i.test(challenge.domain?.salt) ||
    !Number.isInteger(seat.slot) ||
    seat.slot < 0 ||
    seat.slot > 3 ||
    !/^[A-Z2-9]{6}$/.test(seat.room)
  )
    throw Error("Invalid session challenge");
  loadOrCreateKey();
  return {
    address: address(),
    signature: await signTyped(bindData(challenge, seat)),
  };
}
