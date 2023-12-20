# Postgres S3 backups

A simple NodeJS application to backup your PostgreSQL database to S3 via a cron.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/I4zGrH)

## Custom amendmends

I changed it a bit to my likings, for example 1 service being able to handle multiple databases, so for reference:

Env vars that changed:

- `BACKUP_DATABASE_URL` is `BACKUP_DATABASE_URLS` with a "|" between the urls
- Add new env var `PROJECT_NAMES` with a "|" to name the backup tar zip folder with the project name, corresponds with index of BACKUP_DATABASE_URLS
