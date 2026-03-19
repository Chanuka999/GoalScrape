const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { exec } = require('child_process');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const CSV_FILE = path.join(__dirname, '../data/live_matches.csv');

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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:5000`);
});
