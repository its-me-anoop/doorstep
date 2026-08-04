-- PostGIS gives us the `geography(Point,4326)` column type and the GIST
-- index used by `properties.location`; citext gives us case-insensitive
-- uniqueness on `users.email` (PRD §9.2). drizzle-kit does not know how to
-- emit CREATE EXTENSION statements, so this migration is hand-written and
-- ordered first — every later migration (including 0001, which creates
-- the `citext`- and `geography`-typed columns) depends on it.
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS citext;
