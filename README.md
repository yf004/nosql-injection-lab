A tiny, intentionally vulnerable Node app for learning NoSQL / CQL injection. Run locally only.

## Quick start

1. `npm install`
2. Start **mongodb** (default `mongodb://localhost:27017/testdb`) and **cassandra** (contact `localhost:9042`).
3. `node server.js` — open `http://localhost:3000`

## Endpoints

* `POST /level1/login` — uses `{$where: "..."}` (string‑interpolated JS).
* `POST /level2/login` — passes request body directly to `User.find()`.
* `POST /level3/login` — string‑concatenated CQL query.

## Purpose

Show how unsafe query construction lets attackers bypass auth and read sensitive fields (e.g., `secret`).

## Quick fixes

* Remove `$where`; use standard query objects.
* Validate / whitelist inputs and reject query operators from user input.
* Use parameterized/prepared statements for Cassandra and safe drivers for MongoDB.

