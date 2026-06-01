# LensCast FE

LensCast is a mobile-first React + Vite live streaming UI prototype with camera preview, mic toggle, live stats, and chat simulation.

## Requirements

- Node.js 18+
- npm 9+
- Modern browser with camera permissions enabled

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

## Run For Mobile Devices (LAN)

```bash
npm run dev:host
```

This serves on `0.0.0.0:5173` so your phone can access it through your local network.

## Test On Mobile Using LAN

1. Start host mode:
```bash
npm run dev:host
```
2. Get your computer IP:
```bash
hostname -I
```
3. Open on phone (same Wi-Fi):
```text
http://YOUR_LOCAL_IP:5173
```
4. Allow camera/microphone permissions.
5. Tap `GO LIVE` and use `Flip` to switch front/back camera.

## Test On Mobile Using ngrok

1. Install ngrok and authenticate once:
```bash
ngrok config add-authtoken YOUR_NGROK_TOKEN
```
2. Start app in host mode:
```bash
npm run dev:host
```
3. In another terminal, tunnel Vite port:
```bash
ngrok http 5173
```
4. Open the generated `https://...ngrok-free.app` URL on your phone.
5. Allow camera/microphone permissions when prompted.

Note: iOS camera behavior can differ by browser. Safari is usually the most consistent for WebRTC camera preview.

## Push To GitHub

Repository URL:

```text
git@github.com:jfavila09982/LensCast.git
```

If this is the first push from this folder:

```bash
git init
git add .
git commit -m "feat: initialize LensCast"
git branch -M main
git remote add origin git@github.com:jfavila09982/LensCast.git
git push -u origin main
```

If repo already exists locally:

```bash
git remote remove origin
git remote add origin git@github.com:jfavila09982/LensCast.git
git add .
git commit -m "chore: rename app to LensCast and update setup docs"
git push -u origin main
```
