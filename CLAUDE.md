# RapRecord

Beat download and playback app. Downloads YouTube audio as MP3 and plays it back in the browser.

## Project Structure

- `client/` - Vite + React + TypeScript frontend
- `server/` - Express + TypeScript backend
- `downloads/` - MP3 storage (gitignored)

## Commands

```bash
# Install dependencies
pnpm install

# Run both client and server
pnpm dev

# Run client only (port 5173)
pnpm --filter client dev

# Run server only (port 3001)
pnpm --filter server dev
```

## API

- `POST /api/download` - Download YouTube audio. Body: `{ "url": "..." }`. Returns: `{ "id": "...", "title": "..." }`
- `GET /api/audio/:id` - Stream MP3 file

## Prerequisites

- yt-dlp CLI must be installed (`pip install yt-dlp` or `brew install yt-dlp`)
