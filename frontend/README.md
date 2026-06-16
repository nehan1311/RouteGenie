# RouteGenie Frontend

Expo SDK 54 (compatible with current Expo Go).

## Run

1. `cd frontend`
2. `npm install`
3. `npm run start`
4. Scan the QR code with Expo Go on your phone

## API Base URL

The API URL is set in `src/api/client.js`.

- Android emulator: `http://10.0.2.2:8000`
- iOS simulator/web: `http://127.0.0.1:8000`

If your backend runs on another machine, replace those values with your LAN/ngrok URL.
