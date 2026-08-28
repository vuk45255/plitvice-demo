import { register } from "node:module";

/* Lets `node --test` run the ticketing modules as they are written.
 *
 * The project imports by alias — `@/lib/ticketing/store` — which is a
 * bundler's convention and means nothing to Node, and it omits file
 * extensions, which ES modules require. Rather than write the ticketing
 * modules in a second dialect so that they can be tested, the resolver is
 * taught the two rules. Node strips the types itself.
 *
 * Used only by `npm test`. Nothing in the application loads this. */

register("./resolve-alias.mjs", import.meta.url);
