import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

/* ------------------------------------------------------------------ */
/*  Database connection                                                  */
/*  Supports both DATABASE_URL (hosted services like Supabase/Neon)    */
/*  and individual DB_* variables (local development).                  */
/* ------------------------------------------------------------------ */

let pool: Pool;

if (process.env.DATABASE_URL) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === "false"
            ? false
            : { rejectUnauthorized: false },
    });
} else {
    pool = new Pool({
        host:     process.env.DB_HOST,
        port:     Number(process.env.DB_PORT),
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
}

export default pool;