# RDNS-Extractor

Gmail Email Extractor - Node.js/JavaScript Version

This is a JavaScript/Node.js version of the Gmail Email Extractor, maintaining the same beautiful UI and functionality as the Python/Flask version.

## Features

- ✅ Same modern, responsive UI design
- ✅ Connect to Gmail using email and app password
- ✅ Browse and select Gmail labels/folders
- ✅ Extract emails from selected labels
- ✅ Clean email headers (removes sensitive information)
- ✅ Merge extracted emails into a single file
- ✅ Download merged emails
- ✅ Copy to clipboard functionality

## Installation

1. Install Node.js (v14 or higher) if you haven't already

2. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Enter your Gmail credentials:
   - Email address
   - Gmail App Password (not your regular password!)
   
   To create an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"

4. Connect and extract emails as needed!

## Project Structure

```
├── server.js          # Express server with API routes
├── emailUtils.js      # Email processing utilities
├── package.json       # Dependencies and scripts
├── templates/         # HTML templates (shared with Python version)
└── extracted_emails/  # Output folder (created automatically)
```

## API Endpoints

- `GET /` - Serve the web interface
- `POST /connect` - Connect to Gmail and get labels
- `POST /extract` - Extract emails from a label
- `GET /download` - Download the merged email file

## Differences from Python Version

- Uses Node.js/Express instead of Flask
- Uses `imap` npm package for IMAP connections
- All code is in JavaScript
- Same UI and functionality
- Same email cleaning logic

## Requirements

- Node.js 14+
- Gmail account with IMAP enabled
- Gmail App Password (not regular password)

## Notes

- The UI template is shared with the Python version
- All email processing logic is identical
- Output format is the same (merged_emails.txt)
