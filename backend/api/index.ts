/**
 * Vercel Serverless Entry Point
 *
 * Vercel does not call app.listen(). It imports this module and
 * passes requests directly to the Express app as a handler.
 */
import app from "../src/app";

export default app;
