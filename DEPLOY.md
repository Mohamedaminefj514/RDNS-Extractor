# Quick Deployment Guide

## ✅ Your App is Ready!

All critical issues have been fixed. Your app is ready to deploy.

## 🚀 Deployment Options

### Option 1: Railway (Easiest - Recommended)

1. **Sign up at [railway.app](https://railway.app)**
2. **Create new project** → "Deploy from GitHub repo"
3. **Connect your GitHub repository**
4. **Railway will auto-detect Node.js** and run `npm start`
5. **Add Environment Variables** (optional):
   - `CORS_ORIGIN` = your Railway domain (e.g., `https://yourapp.railway.app`)
   - `PORT` = auto-set by Railway
6. **Deploy!** Your app will be live in minutes

### Option 2: Render

1. **Sign up at [render.com](https://render.com)**
2. **New** → **Web Service**
3. **Connect your GitHub repository**
4. **Settings:**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. **Add Environment Variables:**
   - `CORS_ORIGIN` = your Render domain
6. **Deploy!**

### Option 3: Heroku

1. **Install Heroku CLI:** [devcenter.heroku.com](https://devcenter.heroku.com)
2. **Login:**
   ```bash
   heroku login
   ```
3. **Create app:**
   ```bash
   heroku create your-app-name
   ```
4. **Set environment variables:**
   ```bash
   heroku config:set CORS_ORIGIN=https://your-app-name.herokuapp.com
   ```
5. **Deploy:**
   ```bash
   git push heroku main
   ```

### Option 4: VPS (DigitalOcean, AWS, etc.)

1. **SSH into your server**
2. **Install Node.js 14+:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
3. **Clone your repository:**
   ```bash
   git clone your-repo-url
   cd your-repo-folder
   ```
4. **Install dependencies:**
   ```bash
   npm install --production
   ```
5. **Install PM2 (process manager):**
   ```bash
   sudo npm install -g pm2
   ```
6. **Create .env file:**
   ```bash
   nano .env
   ```
   Add:
   ```
   PORT=3000
   CORS_ORIGIN=https://yourdomain.com
   ```
7. **Start with PM2:**
   ```bash
   pm2 start server.js --name email-extractor
   pm2 save
   pm2 startup
   ```
8. **Set up Nginx reverse proxy** (for HTTPS):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
9. **Install SSL with Let's Encrypt:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

## 📝 Important Notes

### Before Deploying:
- ✅ Your code is ready - no changes needed!
- ⚠️ **For production:** Consider setting `CORS_ORIGIN` to your domain (optional but recommended)
- ⚠️ **HTTPS is required** for handling email credentials securely

### After Deploying:
1. Test the connection to Gmail
2. Verify the app loads correctly
3. Test email extraction functionality
4. Monitor logs for any errors

## 🔧 Environment Variables (Optional)

Create a `.env` file or set in your hosting platform:

```env
PORT=3000                    # Usually auto-set by platform
CORS_ORIGIN=https://yourdomain.com  # Your production domain
MAX_FILE_SIZE=10mb           # Max upload size
```

## ✅ Quick Test

After deployment, test these endpoints:
- `GET /` - Should show your app
- `POST /connect` - Test Gmail connection
- `POST /extract` - Test email extraction
- `GET /download` - Test file download

## 🆘 Troubleshooting

**App won't start?**
- Check Node.js version (needs 14+)
- Check if PORT is set correctly
- Check server logs

**Gmail connection fails?**
- Verify IMAP is enabled in Gmail
- Use App Password (not regular password)
- Check firewall/network restrictions

**Need help?** Check `HOSTING_CHECKLIST.md` for detailed information.
