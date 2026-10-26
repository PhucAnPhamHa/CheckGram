# Redis analysis cache

The Fastify API optionally caches normalized suggestion payloads in Redis. Set `REDIS_URL` to enable it; without that variable, analysis continues to work with no cache dependency.

Each cache entry is keyed by:

```text
checkgram:analysis:v1:<sha256-of-text>:<normalized-tone>
```

The JSON payload stores both the SHA-256 and MD5 hashes, text length, suggestions, and cache timestamp. SHA-256 provides the cache key; MD5 is retained as a lightweight integrity/fingerprint field. The cache is scoped by tone so a Professional analysis cannot be incorrectly reused for a Friendly analysis.

`REDIS_CACHE_TTL_SECONDS` defaults to one hour. Redis connection, read, and write errors are logged and treated as cache misses rather than failing text analysis. The REST endpoint includes `cached`; streaming `suggestions.block` events include the same flag.

For local development:

```bash
docker run --name checkgram-redis -p 6379:6379 redis:7-alpine
```
