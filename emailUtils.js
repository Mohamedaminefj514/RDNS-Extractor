const fs = require('fs').promises;
const path = require('path');

/**
 * Clean email headers - removes specified headers and sanitizes content
 */
function cleanEmailHeaders(emailContent) {
    const headersToRemove = [
        'Delivered-To',
        'ARC-Seal',
        'ARC-Message-Signature',
        'ARC-Authentication-Results',
        'Return-Path',
        'Received-SPF',
        'Authentication-Results',
        'DKIM-Signature',
        'cender',
        'X-Received',
        'X-Google-Smtp-Source'
    ];
    
    // Split while keeping line endings
    const lines = emailContent.split(/\r?\n/);
    const cleanedLines = [];
    let skipSection = false;
    let currentHeader = null;
    let ccExists = false;
    
    // First pass: Check if Cc exists
    for (const line of lines) {
        if (line.toLowerCase().startsWith('cc:')) {
            ccExists = true;
            break;
        }
    }
    
    // Second pass: Process the email
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineEnding = (i < lines.length - 1) ? '\n' : '';
        const lineStripped = line.trim();
        
        // Check if line starts with any header to remove
        let headerFound = false;
        for (const header of headersToRemove) {
            if (line.toLowerCase().startsWith(header.toLowerCase() + ':')) {
                skipSection = true;
                headerFound = true;
                currentHeader = header;
                break;
            }
        }
        
        // If we're in a header section to skip
        if (skipSection) {
            // If we hit a new header or empty line, stop skipping
            if ((line.includes(':') && !line.match(/^[\s\t]/)) || !lineStripped) {
                if (currentHeader && !headersToRemove.some(h => line.toLowerCase().startsWith(h.toLowerCase() + ':'))) {
                    skipSection = false;
                    currentHeader = null;
                }
            }
            // Always skip lines that are part of the current header section
            if (skipSection) {
                continue;
            }
        }
        
        // Add the line if not in a section to skip
        if (!headerFound) {
            if (line.toLowerCase().startsWith('date:')) {
                cleanedLines.push('Date: [DATE]' + lineEnding);
                continue;
            }
            if (line.toLowerCase().startsWith('message-id:')) {
                const parts = line.split(':', 2);
                if (parts.length > 1) {
                    let msgId = parts[1].trim();
                    // Insert [EID] before @ if it exists
                    if (msgId.includes('@')) {
                        msgId = msgId.replace('@', '[EID]@');
                    }
                    cleanedLines.push(`Message-ID: ${msgId}${lineEnding}`);
                }
                continue;
            }
            if (line.toLowerCase().startsWith('from:')) {
                const parts = line.split(':', 2);
                if (parts.length > 1) {
                    let fromHeader = parts[1].trim();
                    // Replace domain with [RDNS] while keeping @ and angle brackets
                    if (fromHeader.includes('@')) {
                        if (fromHeader.includes('<') && fromHeader.includes('>')) {
                            const start = fromHeader.indexOf('<');
                            const end = fromHeader.lastIndexOf('>');
                            if (start < end) {
                                const emailPart = fromHeader.substring(start + 1, end);
                                if (emailPart.includes('@')) {
                                    const localPart = emailPart.split('@')[0];
                                    const newEmail = `${localPart}@[RDNS]`;
                                    fromHeader = fromHeader.substring(0, start + 1) + newEmail + fromHeader.substring(end);
                                }
                            }
                        } else {
                            // No angle brackets, just replace the domain
                            const localPart = fromHeader.split('@')[0];
                            fromHeader = `${localPart}@[RDNS]`;
                        }
                    }
                    cleanedLines.push(`From: ${fromHeader}${lineEnding}`);
                }
                continue;
            }
            if (line.toLowerCase().startsWith('to:')) {
                let started = '';
                let ended = '';
                if (line.includes('<') && line.includes('>')) {
                    started = '<';
                    ended = '>';
                }
                cleanedLines.push(`To: ${started}[*to]${ended}${lineEnding}`);
                
                // Add Cc header if it doesn't exist
                if (!ccExists) {
                    cleanedLines.push(`Cc: [*to]${lineEnding}`);
                    ccExists = true;
                }
                continue;
            }
            cleanedLines.push(line + lineEnding);
        }
    }
    
    return cleanedLines.join('');
}

/**
 * Clean extracted folder - delete all files inside but keep the folder
 */
async function cleanExtractedFolder(folderPath) {
    try {
        const files = await fs.readdir(folderPath);
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            try {
                const stat = await fs.stat(filePath);
                if (stat.isDirectory()) {
                    await fs.rm(filePath, { recursive: true, force: true });
                } else {
                    await fs.unlink(filePath);
                }
            } catch (err) {
                console.error(`Failed to delete ${filePath}: ${err.message}`);
            }
        }
    } catch (err) {
        // Folder doesn't exist, that's okay
        if (err.code !== 'ENOENT') {
            console.error(`Error cleaning folder: ${err.message}`);
        }
    }
}

/**
 * Merge all .txt files in folder into one file
 */
async function mergeTxtFiles(inputFolder, outputFile, separator) {
    try {
        const files = (await fs.readdir(inputFolder))
            .filter(f => f.endsWith('.txt') && f.startsWith('email_'))
            .sort();
        
        if (files.length === 0) {
            return false;
        }
        
        let content = '';
        for (let i = 0; i < files.length; i++) {
            const filePath = path.join(inputFolder, files[i]);
            const fileContent = await fs.readFile(filePath, 'utf8');
            content += fileContent;
            if (i < files.length - 1) {
                content += `\n${separator}\n`;
            }
        }
        
        await fs.writeFile(outputFile, content, 'utf8');
        return true;
    } catch (err) {
        console.error(`Error merging files: ${err.message}`);
        return false;
    }
}

module.exports = {
    cleanEmailHeaders,
    cleanExtractedFolder,
    mergeTxtFiles
};
