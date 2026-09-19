# 🌍 ZeroPlastic Cleanup Check-In System

A real-time QR code check-in application for managing event participation. Participants scan a QR code or enter their NIC number to:
- **Quick Check-in:** NIC already registered → instant check-in
- **Register & Check-in:** NIC not found → register with name, mobile, university → check-in

## Features

✅ **QR Code Scanning** - Print/display QR codes for easy check-in
✅ **NIC Search** - Instant participant lookup
✅ **Auto-Matching** - Participants auto-recognized if in the database
✅ **New Registration** - Register new participants on-the-fly
✅ **Real-time Updates** - Instant Monday.com board updates
✅ **Mobile Friendly** - Works on any device
✅ **Zero Backend** - Serverless, uses Monday.com API only

## Setup

### 1. Get Your Monday.com API Token

1. Go to: https://monday.com/users/me/api
2. Generate your Personal API Token
3. Copy the token

### 2. Local Development

```bash
npm install
```

Create `.env.local`:
```
VITE_MONDAY_API_TOKEN=your_token_here
```

Run locally:
```bash
npm run dev
```

### 3. Deploy to Vercel

1. Push to GitHub repo
2. Connect repo to Vercel (https://vercel.com/import)
3. Add environment variable in Vercel dashboard:
   - `VITE_MONDAY_API_TOKEN` = your token
4. Deploy!

## Usage

### For Event Organizers
1. Download the QR code from the app
2. Print or display on a screen/tablet
3. Participants scan to check in

### For Participants
**Option 1: Quick Check-in**
- Scan QR or go to the URL
- Enter NIC number
- Click "Search"
- Click "Mark Me As Participated" → Done!

**Option 2: New Registration**
- Scan QR or go to the URL
- Enter NIC number
- If not found, fill registration form
- Click "Check In" → Added to board!

## Architecture

- **Frontend:** React + Vite
- **API:** Monday.com GraphQL API
- **Hosting:** Vercel
- **QR Code:** qrcode.react library

## Board Structure

The app updates your Monday.com board with:
- **NIC Column:** `numeric_mm7brhp6` (search field)
- **Contact Column:** `numeric_mm7bz03e` (WhatsApp number)
- **University Column:** `color_mm7bmtcx` (status field)
- **Participated Column:** `color_mm7b7q8k` (status: Yes/No)

## License

MIT © ZeroPlastic Movement
