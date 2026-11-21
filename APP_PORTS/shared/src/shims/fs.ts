// node:fs in the phone build: the server's file writing (util.ts writeAtomic) is never used on the phone.
const none = (name: string) => (): never => { throw new Error(`fs.${name} is not available in the phone app.`); };
const fs = { mkdirSync: none("mkdirSync"), writeFileSync: none("writeFileSync"), renameSync: none("renameSync"), readFileSync: none("readFileSync"), existsSync: () => false };
export default fs;
