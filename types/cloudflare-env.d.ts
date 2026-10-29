// Optional bindings: absence disables the associated service.
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BRAIZ_METRICS_OPERATOR_TOKEN?: string;
    BRAIZ_METRICS_OPERATOR_EXPIRES?: string;
  }
}
