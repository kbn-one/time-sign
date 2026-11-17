import { get, route } from "@remix-run/fetch-router/routes";

export const routes = route({
  home: get("/"),
  masterPk: get("/master_pk"),
  // A wildcard rather than `:at`: a route-pattern param stops at `.`, and a
  // date such as `2000-01-01T00:00:00.000Z` has to reach the handler whole.
  at: get("/at/*at"),
});
