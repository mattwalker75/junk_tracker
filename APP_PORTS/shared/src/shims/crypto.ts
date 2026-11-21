// node:crypto in the phone build: random ids (server/src/util.ts newId) are all the phone app needs.
const randomBytes = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));
const createHash = (): never => { throw new Error("Password fingerprints are not used in the phone app."); };
export { randomBytes, createHash };
export default { randomBytes, createHash };
