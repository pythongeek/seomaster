import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL || "";

const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

export const db = sql ? drizzle(sql, { schema }) : null;

export { schema };
