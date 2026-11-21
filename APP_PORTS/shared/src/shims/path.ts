// node:path in the phone build (only util.ts writeAtomic uses it, which the phone app never calls).
const path = { dirname: (p: string): string => p.replace(/\/[^/]*$/, "") || "/", join: (...p: string[]): string => p.join("/") };
export default path;
