// Custom Prisma SQL driver adapter pakai mysql2/promise.
// Dibuat karena @prisma/adapter-mariadb (driver `mariadb` npm) gagal connect
// di Hostinger shared hosting — pool selalu return active=0 idle=0 padahal
// mysql2 dgn kredensial yg sama bisa connect normal.
//
// Implementasi minimum yg cukup untuk Prisma 6 + MySQL: queryRaw, executeRaw,
// startTransaction, executeScript, dispose, getConnectionInfo.

import mysql, { type Pool, type PoolConnection, type FieldPacket } from "mysql2/promise";
import {
  ColumnTypeEnum,
  Debug,
  DriverAdapterError,
  type ColumnType,
  type ConnectionInfo,
  type IsolationLevel,
  type SqlDriverAdapter,
  type SqlDriverAdapterFactory,
  type SqlQuery,
  type SqlResultSet,
  type Transaction,
  type TransactionOptions,
  type ArgType,
} from "@prisma/driver-adapter-utils";

const debug = Debug("prisma:driver-adapter:mysql2");
const ADAPTER_NAME = "@prisma/adapter-mysql2-custom";

// mysql2 numeric field types — dari mysql2/lib/constants/types.js
const T = {
  DECIMAL: 0, TINY: 1, SHORT: 2, LONG: 3, FLOAT: 4, DOUBLE: 5, NULL: 6,
  TIMESTAMP: 7, LONGLONG: 8, INT24: 9, DATE: 10, TIME: 11, DATETIME: 12,
  YEAR: 13, NEWDATE: 14, VARCHAR: 15, BIT: 16, JSON: 245, NEWDECIMAL: 246,
  ENUM: 247, SET: 248, TINY_BLOB: 249, MEDIUM_BLOB: 250, LONG_BLOB: 251,
  BLOB: 252, VAR_STRING: 253, STRING: 254, GEOMETRY: 255,
};

const UNSIGNED_FLAG = 1 << 5;
const BINARY_FLAG = 1 << 7;

function mapColumnType(field: FieldPacket): ColumnType {
  const type = (field as any).columnType ?? field.type;
  const flags = (field as any).flags ?? 0;

  switch (type) {
    case T.TINY:
    case T.SHORT:
    case T.INT24:
    case T.YEAR:
      return ColumnTypeEnum.Int32;
    case T.LONG:
      return (flags & UNSIGNED_FLAG) ? ColumnTypeEnum.Int64 : ColumnTypeEnum.Int32;
    case T.LONGLONG:
      return ColumnTypeEnum.Int64;
    case T.FLOAT:
      return ColumnTypeEnum.Float;
    case T.DOUBLE:
      return ColumnTypeEnum.Double;
    case T.TIMESTAMP:
    case T.DATETIME:
      return ColumnTypeEnum.DateTime;
    case T.DATE:
    case T.NEWDATE:
      return ColumnTypeEnum.Date;
    case T.TIME:
      return ColumnTypeEnum.Time;
    case T.DECIMAL:
    case T.NEWDECIMAL:
      return ColumnTypeEnum.Numeric;
    case T.VARCHAR:
    case T.VAR_STRING:
    case T.STRING:
    case T.BLOB:
    case T.TINY_BLOB:
    case T.MEDIUM_BLOB:
    case T.LONG_BLOB:
      return (flags & BINARY_FLAG) ? ColumnTypeEnum.Bytes : ColumnTypeEnum.Text;
    case T.ENUM:
      return ColumnTypeEnum.Enum;
    case T.JSON:
      return ColumnTypeEnum.Json;
    case T.BIT:
    case T.GEOMETRY:
      return ColumnTypeEnum.Bytes;
    case T.NULL:
      return ColumnTypeEnum.Int32;
    default:
      // Fallback ke Text supaya tidak crash — Prisma akan tetap proses sbg string
      return ColumnTypeEnum.Text;
  }
}

function pad(n: number, z = 2) { return String(n).padStart(z, "0"); }

function formatDateTime(date: Date): string {
  const ms = date.getUTCMilliseconds();
  return pad(date.getUTCFullYear(), 4) + "-" + pad(date.getUTCMonth() + 1) + "-" +
    pad(date.getUTCDate()) + " " + pad(date.getUTCHours()) + ":" +
    pad(date.getUTCMinutes()) + ":" + pad(date.getUTCSeconds()) +
    (ms ? "." + String(ms).padStart(3, "0") : "");
}
function formatDate(date: Date): string {
  return pad(date.getUTCFullYear(), 4) + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate());
}
function formatTime(date: Date): string {
  const ms = date.getUTCMilliseconds();
  return pad(date.getUTCHours()) + ":" + pad(date.getUTCMinutes()) + ":" + pad(date.getUTCSeconds()) +
    (ms ? "." + String(ms).padStart(3, "0") : "");
}

function mapArg(arg: unknown, argType: ArgType): unknown {
  if (arg === null || arg === undefined) return null;
  if (typeof arg === "string" && argType.scalarType === "bigint") return BigInt(arg);
  if (typeof arg === "string" && argType.scalarType === "datetime") arg = new Date(arg);
  if (arg instanceof Date) {
    switch (argType.dbType) {
      case "TIME":
      case "TIME2":
        return formatTime(arg);
      case "DATE":
      case "NEWDATE":
        return formatDate(arg);
      default:
        return formatDateTime(arg);
    }
  }
  if (typeof arg === "string" && argType.scalarType === "bytes") return Buffer.from(arg, "base64");
  if (Array.isArray(arg) && argType.scalarType === "bytes") return Buffer.from(arg as number[]);
  if (ArrayBuffer.isView(arg)) {
    return Buffer.from((arg as any).buffer, (arg as any).byteOffset, (arg as any).byteLength);
  }
  return arg;
}

function mapRow(row: any[], fields: FieldPacket[]): unknown[] {
  return row.map((value, i) => {
    if (value === null || value === undefined) return null;
    const fieldType = (fields[i] as any)?.columnType ?? fields[i]?.type;
    // DateTime → ISO string with +00:00 (sesuai format mariadb adapter)
    if (fieldType === T.TIMESTAMP || fieldType === T.DATETIME) {
      // mysql2 dgn dateStrings:true sudah return string "YYYY-MM-DD HH:mm:ss"
      if (typeof value === "string") {
        return new Date(value + "Z").toISOString().replace(/(\.000)?Z$/, "+00:00");
      }
      if (value instanceof Date) {
        return value.toISOString().replace(/(\.000)?Z$/, "+00:00");
      }
    }
    if (Buffer.isBuffer(value)) return Array.from(value);
    if (typeof value === "bigint") return value.toString();
    return value;
  });
}

function convertDriverError(error: any): any {
  const code = error?.errno ?? 0;
  const message = error?.sqlMessage ?? error?.message ?? "N/A";
  const state = error?.sqlState ?? "N/A";

  // Mapping subset error code MySQL ke Prisma error kind. Mirror dari
  // @prisma/adapter-mariadb errors.ts. Yg tidak match → generic "mysql".
  const base = { originalCode: String(code), originalMessage: message };
  switch (code) {
    case 1062: {
      const index = message.split(" ").pop()?.split("'")[1]?.split(".").pop();
      return { ...base, kind: "UniqueConstraintViolation", constraint: index ? { index } : undefined };
    }
    case 1451:
    case 1452: {
      const field = message.split(" ")[17]?.split("`")[1];
      return { ...base, kind: "ForeignKeyConstraintViolation", constraint: field ? { fields: [field] } : undefined };
    }
    case 1263: {
      const index = message.split(" ").pop()?.split("'")[1];
      return { ...base, kind: "NullConstraintViolation", constraint: index ? { index } : undefined };
    }
    case 1264:
      return { ...base, kind: "ValueOutOfRange", cause: message };
    case 1364:
    case 1048: {
      const field = message.split(" ")[1]?.split("'")[1];
      return { ...base, kind: "NullConstraintViolation", constraint: field ? { fields: [field] } : undefined };
    }
    case 1049: {
      const db = message.split(" ").pop()?.split("'")[1];
      return { ...base, kind: "DatabaseDoesNotExist", db };
    }
    case 1044: {
      const db = message.split(" ").pop()?.split("'")[1];
      return { ...base, kind: "DatabaseAccessDenied", db };
    }
    case 1045: {
      const user = message.split(" ")[4]?.split("@")[0]?.split("'")[1];
      return { ...base, kind: "AuthenticationFailed", user };
    }
    case 1146: {
      const table = message.split(" ")[1]?.split("'")[1]?.split(".").pop();
      return { ...base, kind: "TableDoesNotExist", table };
    }
    case 1054: {
      const column = message.split(" ")[2]?.split("'")[1];
      return { ...base, kind: "ColumnNotFound", column };
    }
    case 1213:
      return { ...base, kind: "TransactionWriteConflict" };
    case 1040:
    case 1203:
      return { ...base, kind: "TooManyConnections", cause: message };
    default:
      return { ...base, kind: "mysql", code, message, state };
  }
}

abstract class Mysql2Queryable {
  abstract executor: Pool | PoolConnection;
  provider = "mysql" as const;
  adapterName = ADAPTER_NAME;

  protected async performIO(query: SqlQuery): Promise<[any[], FieldPacket[]]> {
    const { sql, args, argTypes } = query;
    try {
      const values = args.map((a, i) => mapArg(a, argTypes[i]));
      const [rows, fields] = await (this.executor as any).query({
        sql,
        rowsAsArray: true,
        dateStrings: true,
      }, values);
      return [rows as any[], fields as FieldPacket[]];
    } catch (e: any) {
      debug("Error in performIO: %O", e);
      throw new DriverAdapterError(convertDriverError(e));
    }
  }

  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    debug("[js::query_raw] %O", query);
    const [rows, fields] = await this.performIO(query);
    const safeFields = fields ?? [];
    return {
      columnNames: safeFields.map((f) => f.name),
      columnTypes: safeFields.map(mapColumnType),
      rows: Array.isArray(rows) ? rows.map((r) => mapRow(r, safeFields)) : [],
      lastInsertId: (rows as any)?.insertId !== undefined ? String((rows as any).insertId) : undefined,
    };
  }

  async executeRaw(query: SqlQuery): Promise<number> {
    debug("[js::execute_raw] %O", query);
    const { sql, args, argTypes } = query;
    try {
      const values = args.map((a, i) => mapArg(a, argTypes[i]));
      const [result] = await (this.executor as any).query(sql, values);
      return (result as any)?.affectedRows ?? 0;
    } catch (e: any) {
      debug("Error in executeRaw: %O", e);
      throw new DriverAdapterError(convertDriverError(e));
    }
  }
}

class Mysql2Transaction extends Mysql2Queryable implements Transaction {
  executor: PoolConnection;
  readonly options: TransactionOptions = { usePhantomQuery: false };

  constructor(conn: PoolConnection) {
    super();
    this.executor = conn;
  }

  async commit(): Promise<void> {
    debug("[js::commit]");
    try {
      await this.executor.query("COMMIT");
    } finally {
      this.executor.release();
    }
  }

  async rollback(): Promise<void> {
    debug("[js::rollback]");
    try {
      await this.executor.query("ROLLBACK");
    } finally {
      this.executor.release();
    }
  }
}

class Mysql2Adapter extends Mysql2Queryable implements SqlDriverAdapter {
  executor: Pool;
  private database?: string;

  constructor(pool: Pool, database?: string) {
    super();
    this.executor = pool;
    this.database = database;
  }

  async executeScript(script: string): Promise<void> {
    try {
      // multipleStatements harus diaktifkan di pool config supaya bisa run script
      await this.executor.query(script);
    } catch (e: any) {
      throw new DriverAdapterError(convertDriverError(e));
    }
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      schemaName: this.database,
      supportsRelationJoins: false,
    };
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    debug("[js::startTransaction]");
    const conn = await this.executor.getConnection();
    try {
      if (isolationLevel) {
        await conn.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      }
      await conn.query("BEGIN");
      return new Mysql2Transaction(conn);
    } catch (e: any) {
      conn.release();
      throw new DriverAdapterError(convertDriverError(e));
    }
  }

  async dispose(): Promise<void> {
    await this.executor.end();
  }
}

export type PrismaMysql2Options = {
  host: string;
  port?: number;
  user: string;
  password?: string;
  database: string;
  connectionLimit?: number;
  connectTimeout?: number;
  multipleStatements?: boolean;
};

export class PrismaMysql2 implements SqlDriverAdapterFactory {
  readonly provider = "mysql" as const;
  readonly adapterName = ADAPTER_NAME;
  private config: PrismaMysql2Options;

  constructor(config: PrismaMysql2Options) {
    this.config = config;
  }

  async connect(): Promise<SqlDriverAdapter> {
    const pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port ?? 3306,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      waitForConnections: true,
      connectionLimit: this.config.connectionLimit ?? 10,
      queueLimit: 0,
      connectTimeout: this.config.connectTimeout ?? 10000,
      // Penting utk Prisma: BIGINT sbg string supaya tidak lose precision
      supportBigNumbers: true,
      bigNumberStrings: true,
      // JSON dibiarkan sbg string — Prisma yg handle parsing
      typeCast: (field: any, next: any) => {
        if (field.type === "JSON") return field.string();
        return next();
      },
      // Untuk executeScript (prisma migrate / raw multi-statement)
      multipleStatements: this.config.multipleStatements ?? true,
      // dateStrings di-set per-query di performIO supaya konsisten dgn mariadb adapter
    });

    return new Mysql2Adapter(pool, this.config.database);
  }
}
