#!/bin/sh
set -e

# Apply any pending Drizzle migrations, then start the server.
node docker/migrate.mjs

exec node build
