// Operator commands use Node's type stripping; Prisma's bundler-oriented generated
// imports also need relative .ts resolution. This does not run in the web app.
import { register } from "node:module";
register("./resolve-typescript.mjs", import.meta.url);
