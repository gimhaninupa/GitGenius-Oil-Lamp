const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = 8000;
const WEBSOCKET_MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const clients = new Set();
let globalState = null;

// --- HTTP Static File Server ---
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './' || filePath === './index') {
        filePath = './index.html';
    }

    // Strip query parameters
    filePath = filePath.split('?')[0];

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code} ..\n`);
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(content, 'utf-8');
        }
    });
});

// --- Native WebSocket Server Logic ---

server.on('upgrade', (req, socket, head) => {
    if (req.headers['upgrade'] && req.headers['upgrade'].toLowerCase() === 'websocket') {
        handleWebSocketHandshake(req, socket);
    } else {
        socket.destroy();
    }
});

function handleWebSocketHandshake(req, socket) {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
        socket.destroy();
        return;
    }

    // Generate WebSocket accept key
    const shasum = crypto.createHash('sha1');
    shasum.update(key + WEBSOCKET_MAGIC_STRING);
    const acceptKey = shasum.digest('base64');

    // Send HTTP/1.1 switching protocols handshake response
    const responseHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '\r\n'
    ];

    socket.write(responseHeaders.join('\r\n'));

    // Track client socket
    clients.add(socket);

    // Socket message handlers
    socket.on('data', (buffer) => {
        decodeWebSocketFrame(socket, buffer);
    });

    socket.on('close', () => {
        clients.delete(socket);
    });

    socket.on('error', (err) => {
        console.error("Socket error:", err.message);
        clients.delete(socket);
    });
}

function decodeWebSocketFrame(socket, buffer) {
    if (buffer.length < 2) return;

    let offset = 0;
    const firstByte = buffer.readUInt8(offset++);
    const fin = (firstByte & 0x80) !== 0;
    const opcode = firstByte & 0x0f;

    // Handle close connection control frame
    if (opcode === 8) {
        clients.delete(socket);
        socket.destroy();
        return;
    }

    // We only process text frames (opcode 1)
    if (opcode !== 1) return;

    const secondByte = buffer.readUInt8(offset++);
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLen = secondByte & 0x7f;

    if (payloadLen === 126) {
        if (buffer.length < 4) return;
        payloadLen = buffer.readUInt16BE(offset);
        offset += 2;
    } else if (payloadLen === 127) {
        if (buffer.length < 10) return;
        // Ignore upper 4 bytes for simple offsets
        payloadLen = buffer.readUInt32BE(offset + 4);
        offset += 8;
    }

    if (buffer.length < offset + (isMasked ? 4 : 0) + payloadLen) return;

    let maskingKey;
    if (isMasked) {
        maskingKey = buffer.slice(offset, offset + 4);
        offset += 4;
    }

    const rawPayload = buffer.slice(offset, offset + payloadLen);
    let message = '';

    if (isMasked && maskingKey) {
        for (let i = 0; i < rawPayload.length; i++) {
            message += String.fromCharCode(rawPayload[i] ^ maskingKey[i % 4]);
        }
    } else {
        message = rawPayload.toString('utf8');
    }

    handleClientMessage(socket, message);
}

function encodeWebSocketFrame(message) {
    const payload = Buffer.from(message, 'utf8');
    const len = payload.length;
    let header;

    if (len <= 125) {
        header = Buffer.alloc(2);
        header.writeUInt8(0x81, 0); // Text frame, FIN
        header.writeUInt8(len, 1);
    } else if (len <= 65535) {
        header = Buffer.alloc(4);
        header.writeUInt8(0x81, 0);
        header.writeUInt8(126, 1);
        header.writeUInt16BE(len, 2);
    } else {
        header = Buffer.alloc(10);
        header.writeUInt8(0x81, 0);
        header.writeUInt8(127, 1);
        header.writeBigUInt64BE(BigInt(len), 2);
    }

    return Buffer.concat([header, payload]);
}

function broadcast(message, senderSocket = null) {
    const frame = encodeWebSocketFrame(message);
    for (const client of clients) {
        if (client !== senderSocket && client.writable) {
            client.write(frame);
        }
    }
}

function handleClientMessage(socket, rawMessage) {
    try {
        const msg = JSON.parse(rawMessage);

        if (msg.type === 'sync_state' && msg.state) {
            globalState = msg.state;
            // Broadcast the state update to everyone else
            broadcast(rawMessage, socket);
        } 
        else if (msg.type === 'request_state') {
            // Send back the current ceremony state if it exists
            if (globalState) {
                const response = JSON.stringify({
                    type: 'sync_state',
                    state: globalState
                });
                if (socket.writable) {
                    socket.write(encodeWebSocketFrame(response));
                }
            }
        }
    } catch (e) {
        console.error("Failed to parse websocket JSON message:", e.message);
    }
}

// --- Start Server & Log Network Configuration ---

server.listen(PORT, () => {
    console.log('\n=============================================================');
    console.log('       🌟 VIRTUAL OIL LAMP LIGHTING CEREMONY SERVER 🌟       ');
    console.log('=============================================================');
    console.log(`\nLocal Web Server running at: http://localhost:${PORT}`);
    
    // Find local IP addresses on Wi-Fi network
    const interfaces = os.networkInterfaces();
    let foundIp = false;

    console.log('\nTo connect your Tablet (Tab) over Wi-Fi, open this URL:');
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Filter only IPv4 and non-internal addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(` 👉 http://${iface.address}:${PORT}/controller.html`);
                foundIp = true;
            }
        }
    }

    if (!foundIp) {
        console.log(' ⚠️  No local Wi-Fi IP detected. Make sure you are connected to a router.');
    }
    
    console.log('\nDisplay Screen (Projector/TV) URL:');
    console.log(` 👉 http://localhost:${PORT}/index.html`);
    console.log('=============================================================\n');
});
