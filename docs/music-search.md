# Local music setup

On Repeat searches Apple's catalogue and can persist one song per profile in an isolated local PostgreSQL database.

## Run locally

Use Node 22 and install dependencies. PostgreSQL setup requires Postgres.app.

```sh
npm run db:local
npm run dev
```

The setup command creates `.local/postgres`, listens on `127.0.0.1:55432`, creates `margin_local`, applies committed migrations, and writes local database URLs into ignored `.env`. It preserves unrelated environment settings. `npm run db:local:stop` stops only that cluster.

The application role has table access; a separate owner role runs migrations. Credentials and database files remain local and must not be committed.

## Behavior and boundaries

Search returns title, artist, artwork, and the original song link. Choosing a song replaces the profile's previous selection atomically. Failures are reported rather than presented as successful saves. Refresh retains a saved song when the local database is available.

The catalogue adapter validates provider data, bounds response size and request duration, caches/coalesces searches, and limits upstream requests. It allows only the configured Apple artwork hosts and disables image redirects. Spotify destinations open search results. There is no playback, lyrics, video, or audio preview.

The music API is development-only and uses a fixed fictional actor. Local origin and database checks restrict access; they are not production authentication. Production music access must use server-derived account identity and authorization.

Apple artwork and badge usage needs review against the [identity guidelines](https://marketing.services.apple/itunes-identity-guidelines) and [Search API terms](https://performance-partners.apple.com/search-api) before public release.

## Optional integration checks

```sh
npm run test:db
npm run test:music:live
```

Both require the isolated local database. The live check also needs internet access. They use temporary subjects and clean up their records; these checks do not verify hosted services or real account access.
