// The part of sql.js (SQLite compiled to WebAssembly) that sqlite.ts uses.
declare module "sql.js" {
  export type SqlValue = number | string | Uint8Array | null;
  export type BindParams = SqlValue[] | Record<string, SqlValue> | null;
  export interface Statement {
    bind(values?: BindParams): boolean;
    step(): boolean;
    getAsObject(): Record<string, SqlValue>;
    free(): boolean;
  }
  export interface Database {
    exec(sql: string): { columns: string[]; values: SqlValue[][] }[];
    run(sql: string, params?: BindParams): Database;
    prepare(sql: string): Statement;
    getRowsModified(): number;
    export(): Uint8Array;
    close(): void;
  }
  export interface SqlJsStatic { Database: new (data?: ArrayLike<number> | Uint8Array | null) => Database }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string; wasmBinary?: ArrayBuffer | Uint8Array }): Promise<SqlJsStatic>;
}
