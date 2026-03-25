const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { exec } = require('child_process');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const PORT = 5000;

const io = new Server(server, {
    cors: {
        origin: "*", // allow React frontend to connect
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const CSV_FILE = path.join(__dirname, '../data/live_matches.csv');

// WebSockets Connection
io.on('connection', (socket) => {
    console.log('New client connected via WebSockets');
    socket.on('disconnect', () => {
        console.log('Client disconnected from WebSockets');
    });
});

// Watch CSV file for changes and broadcast
fs.watchFile(CSV_FILE, { interval: 1000 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
        const results = [];
        if (!fs.existsSync(CSV_FILE)) return;
        
        fs.createReadStream(CSV_FILE)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                console.log('[WebSocket] Sending updated matches to all clients');
                io.emit('matches_update', results);
            });
    }
});

// GET all matches from CSV
app.get('/api/matches', (req, res) => {
    const results = [];
    if (!fs.existsSync(CSV_FILE)) {
        return res.json({ success: true, data: [] });
    }
    
    fs.createReadStream(CSV_FILE)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            res.json({ success: true, data: results });
        });
});

// GET World Cup History
app.get('/api/history', (req, res) => {
    const historyFile = path.join(__dirname, '../data/fifa_history.json');
    if (!fs.existsSync(historyFile)) {
        return res.json({ success: true, data: [] });
    }
    try {
        const raw = fs.readFileSync(historyFile);
        const parsed = JSON.parse(raw);
        res.json({ success: true, data: parsed });
    } catch(e) {
        res.json({ success: false, data: [] });
    }
});

// Trigger Scraper
app.post('/api/scrape', (req, res) => {
    const scriptPath = path.join(__dirname, '../scraper/main.py');
    console.log(`Executing: python "${scriptPath}"`);
    
    exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Exec error: ${error}`);
            return res.status(500).json({ success: false, error: error.message });
        }
        console.log(`Scraper stdout: ${stdout}`);
        res.json({ success: true, output: stdout });
    });
});

// GET Real-time Lineups for a specific MatchID
app.get('/api/lineups/:id', (req, res) => {
    const matchId = req.params.id;
    const scriptPath = path.join(__dirname, '../scraper/lineup_scraper.py');
    console.log(`[Backend] Fetching lineups for match: ${matchId}`);
    
    // Increased timeout to 40 seconds to be safer
    exec(`python "${scriptPath}" ${matchId}`, { timeout: 40000 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[Backend] Exec Error: ${error.message}`);
            if (stderr) console.error(`[Backend] Python Stderr: ${stderr}`);
            return res.json({ success: false, error: 'Request Timed out or Scraper Crashed' });
        }
        
        try {
            const lineups = JSON.parse(stdout);
            console.log(`[Backend] Success for ${matchId}`);
            res.json({ success: true, data: lineups });
        } catch (e) {
            console.error(`[Backend] JSON Parse Error. Output: ${stdout}`);
            res.json({ success: false, error: 'Could not parse player data' });
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:5000 (with WebSockets)`);
});
