# 🚀 Deployment Guide

## Step 1: Prepare Your GitHub Repository

Your repo is already created: https://github.com/ZeroPlastic-Movement/ZeroPlasticTrail2026

Create a new folder in it called `cleanup-checkin/` and copy all files from this project there, OR replace the entire repo content with this project.

## Step 2: Push to GitHub

```bash
cd /path/to/ZeroPlasticTrail2026
git add .
git commit -m "Initial commit: ZeroPlastic Cleanup Check-In System"
git push origin main
```

## Step 3: Set Up Vercel

### Option A: Using Vercel Dashboard (Recommended)

1. Go to: https://vercel.com
2. Click "New Project"
3. Select "Import Git Repository"
4. Choose your GitHub repo: `ZeroPlastic-Movement/ZeroPlasticTrail2026`
5. Click "Import"
6. In "Environment Variables", add:
   - **Name:** `VITE_MONDAY_API_TOKEN`
   - **Value:** Paste your token (from the image you showed)
7. Click "Deploy"

### Option B: Using Vercel CLI

```bash
npm install -g vercel

vercel login

vercel --env VITE_MONDAY_API_TOKEN=your_token_here
```

## Step 4: Get Your Live URL

After deployment, Vercel will give you a URL like:
```
https://zp-cleanup-checkin.vercel.app
```

## Step 5: Download QR Code

1. Visit your live URL
2. Click "📥 Download QR Code"
3. Print it or display on a tablet at your event

## Step 6: Event Day

1. Print the QR code or display on screen
2. Participants scan with their phones
3. They enter their NIC or register
4. Check your Monday.com board in real-time for updates!

---

## Testing

Before the event, test with:
- NIC from your board: Should show welcome message
- Random NIC: Should show registration form
- After checking in: Verify "Participated" column updates to "Yes"

## Troubleshooting

### "Error searching participant"
- Check your Monday.com API token is valid
- Verify Board ID is correct: 5031418117

### "Can't connect to Monday.com"
- Check internet connection
- Verify token hasn't expired
- Regenerate token if needed at: https://monday.com/users/me/api

### QR Code Not Working
- Make sure QR code is clear and not pixelated
- Try scanning with different phone cameras
- Check URL in QR code is correct

---

## Support

For questions, contact: nish@zeroplasticmovement.org
