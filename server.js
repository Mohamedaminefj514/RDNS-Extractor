require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
const fs = require('fs').promises;
const Imap = require('imap');
const { cleanEmailHeaders, cleanExtractedFolder, mergeTxtFiles } = require('./emailUtils');

const app = express();

// Configuration
const UPLOAD_FOLDER = path.join(__dirname, 'extracted_emails');
const OUTPUT_FILE = 'merged_emails.txt';
const PORT = process.env.PORT || 3000;
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || '10mb';

// Trust proxy (required for Railway, Render, Heroku, etc.)
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
        },
    },
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  optionsSuccessStatus: 200
}));
app.use(compression());
app.use(express.json({ limit: MAX_FILE_SIZE }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Serve static files from the root directory (for assets if needed)
// Note: index.html is served via the '/' route below

// Ensure upload folder exists
(async () => {
    try {
        await fs.mkdir(UPLOAD_FOLDER, { recursive: true });
    } catch (err) {
        console.error('Error creating upload folder:', err);
    }
})();

// Helper function to connect to IMAP
function connectIMAP(email, password) {
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user: email,
            password: password,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        });

        imap.once('ready', () => resolve(imap));
        imap.once('error', reject);
        imap.connect();
    });
}

// Route: Serve index page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route: Connect to Gmail and get labels
app.post('/connect', async (req, res) => {
    let imap = null;
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.json({ success: false, error: 'Email and password are required' });
        }

        // Connect to Gmail
        imap = await connectIMAP(email, password);

        // Get all labels using LIST command
        const labels = await new Promise((resolve, reject) => {
            const labelList = [];
            imap.getBoxes((err, boxes) => {
                if (err) {
                    reject(err);
                    return;
                }

                const getAllBoxes = async (boxesObj, prefix = '') => {
                    const promises = [];
                    
                    for (const [name, box] of Object.entries(boxesObj)) {
                        const fullName = prefix ? `${prefix}${box.delimiter}${name}` : name;
                        
                        // Skip special system folders that start with \
                        if (!fullName.includes('\\')) {
                            const statusPromise = new Promise((resolveStatus) => {
                                imap.status(fullName, (err, status) => {
                                    if (!err && status) {
                                        labelList.push({
                                            name: fullName,
                                            count: status.messages || 0
                                        });
                                    }
                                    resolveStatus();
                                });
                            });
                            promises.push(statusPromise);
                        }

                        if (box.children) {
                            promises.push(getAllBoxes(box.children, fullName));
                        }
                    }
                    
                    await Promise.all(promises);
                };

                // Wait for all status calls to complete
                getAllBoxes(boxes).then(() => {
                    resolve(labelList);
                }).catch(reject);
            });
        });

        if (labels.length === 0) {
            imap.end();
            return res.json({ success: false, error: 'No accessible labels found' });
        }

        imap.end();

        // Sort labels alphabetically
        labels.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        return res.json({
            success: true,
            labels: labels
        });

    } catch (error) {
        if (imap) {
            imap.end();
        }
        return res.json({ success: false, error: error.message });
    }
});

// Route: Extract emails
app.post('/extract', async (req, res) => {
    let imap = null;
    try {
        const { email, password, label, start, count } = req.body;

        if (!email || !password || !label) {
            return res.json({ success: false, error: 'Email, password, and label are required' });
        }

        const startNum = parseInt(start) || 1;
        const countNum = parseInt(count) || 10;

        // Clean previous extractions
        await cleanExtractedFolder(UPLOAD_FOLDER);
        await fs.mkdir(UPLOAD_FOLDER, { recursive: true });

        // Connect to Gmail
        imap = await connectIMAP(email, password);

        // Open the label/folder
        await new Promise((resolve, reject) => {
            imap.openBox(label, true, (err, box) => {
                if (err) reject(err);
                else resolve(box);
            });
        });

        // Search for all emails
        const emailIds = await new Promise((resolve, reject) => {
            imap.search(['ALL'], (err, results) => {
                if (err) reject(err);
                else resolve(results.reverse()); // Newest first
            });
        });

        const totalEmails = emailIds.length;
        const startIdx = Math.max(0, Math.min(startNum - 1, totalEmails - 1));
        const endIdx = Math.min(startIdx + countNum, totalEmails);
        const selectedIds = emailIds.slice(startIdx, endIdx);

        // Fetch and save emails
        let extractedCount = 0;
        for (let i = 0; i < selectedIds.length; i++) {
            try {
                const emailId = selectedIds[i];
                const fetch = imap.fetch(emailId, { bodies: '' });

                await new Promise((resolve, reject) => {
                    let emailBody = '';
                    fetch.on('message', (msg, seqno) => {
                        msg.on('body', (stream, info) => {
                            stream.on('data', (chunk) => {
                                emailBody += chunk.toString('utf8');
                            });
                        });

                        msg.once('end', async () => {
                            try {
                                const cleanedContent = cleanEmailHeaders(emailBody);
                                const outputFile = path.join(UPLOAD_FOLDER, `email_${startIdx + i + 1}.txt`);
                                await fs.writeFile(outputFile, cleanedContent, 'utf8');
                                extractedCount++;
                            } catch (err) {
                                console.error(`Error processing email: ${err.message}`);
                            }
                        });
                    });

                    fetch.once('error', reject);
                    fetch.once('end', () => {
                        setTimeout(resolve, 100); // Give time for processing
                    });
                });
            } catch (err) {
                console.error(`Error extracting email ${i + 1}:`, err.message);
                continue;
            }
        }

        // Merge files
        await mergeTxtFiles(UPLOAD_FOLDER, OUTPUT_FILE, '\n__SEP__\n\n');

        // Read merged content
        const content = await fs.readFile(OUTPUT_FILE, 'utf8');

        imap.end();

        return res.json({
            success: true,
            extracted: extractedCount,
            content: content
        });

    } catch (error) {
        if (imap) {
            imap.end();
        }
        return res.json({ success: false, error: error.message });
    }
});

// Route: Download merged file
app.get('/download', (req, res) => {
    res.download(OUTPUT_FILE, 'merged_emails.txt', (err) => {
        if (err) {
            console.error('Download error:', err);
            res.status(500).send('File not found');
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});