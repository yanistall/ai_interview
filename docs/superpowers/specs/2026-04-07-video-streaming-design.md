# Video Streaming Performance Design

**Date:** 2026-04-07  
**Status:** Approved

## Problem

`fetchVideoBlobUrl` downloads the entire video as a Blob before playback begins. For long interviews (30–60 min, potentially hundreds of MB), this causes unacceptable wait times. The backend already supports HTTP 206 Range Requests, but the browser's native `<video>` element cannot send custom `Authorization: Bearer` headers, blocking direct streaming.

## Solution: Short-lived Video Access Token (Option A)

Introduce a dedicated short-lived token for video access. The main JWT is never exposed in URLs. The browser's native `<video>` element streams directly using HTTP 206 Range Requests.

## Architecture

### New Backend Endpoint

**`GET /api/videos/token/:filename`**

- Protected by `authenticate` middleware (validates main JWT)
- Checks the file exists in `server/uploads/`
- Signs a short-lived JWT using the existing `JWT_SECRET`:
  - Payload: `{ filename, userId }`
  - TTL: 5 minutes
- Returns `{ token: string, expiresAt: number }`

### Modified Backend Endpoint

**`GET /api/videos/:filename`**

- Remove `authenticate` middleware
- Read token from query param `?token=xxx`
- Validate token: verify signature with `JWT_SECRET`, check `filename` in payload matches request param
- Return 401 if token is missing, invalid, expired, or filename mismatch
- All existing Range Request (HTTP 206) logic unchanged

### Frontend Changes

**`services/db.ts`**

- Add `fetchVideoToken(filename: string): Promise<string>` — calls `GET /api/videos/token/:filename`, returns the token string
- Remove `fetchVideoBlobUrl` (no longer needed)
- Keep `getVideoUrl`, `saveVideo`, `deleteVideo` unchanged

**`components/ReportView.tsx`**

- `useEffect` on `report.videoPath`:
  - Call `fetchVideoToken(report.videoPath)` to get short-lived token
  - Set `videoUrl` to `/api/videos/${filename}?token=${token}`
  - No Blob download, no `URL.createObjectURL`
- Remove `URL.revokeObjectURL` cleanup (no longer needed)
- `<video src={videoUrl}>` streams directly via browser Range Requests

## Data Flow

```
1. ReportView mounts → GET /api/videos/token/:filename (with main JWT)
2. Backend validates JWT → signs 5-min video token → returns { token, expiresAt }
3. Frontend sets <video src="/api/videos/xxx.webm?token=yyy">
4. Browser sends Range Request → backend validates video token → streams chunk
5. Playback starts immediately; scrubbing works natively
```

## Security Considerations

- Main JWT never appears in URLs (not in browser history, server logs, or Referer headers)
- Video token is scoped to a single filename and user; cannot be reused for other files
- 5-minute TTL limits the exposure window if a token is leaked
- Filename is validated inside the token payload to prevent token reuse across files
- Token lives in component state only (not localStorage, not cookies)

## Error Handling

- If `fetchVideoToken` fails: show existing `videoError` state ("影片載入失敗，請稍後重試")
- Backend returns 401 for invalid/expired token; browser video element shows load error, caught by `onError` event if needed
- File-not-found returns 404 (unchanged)

## Files Changed

| File | Change |
|------|--------|
| `server/src/routes/videos.ts` | Add `GET /token/:filename` endpoint; modify `GET /:filename` to accept query token |
| `services/db.ts` | Add `fetchVideoToken`; remove `fetchVideoBlobUrl` |
| `components/ReportView.tsx` | Use token URL instead of blob URL; remove blob cleanup |
