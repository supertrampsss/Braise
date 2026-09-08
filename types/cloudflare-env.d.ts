// Optional starter storage helper. Braise itself has no DB binding.
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
  }
}
