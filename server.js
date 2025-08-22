import express from 'express';
import fetch from 'node-fetch';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config(); // burayı ekledik


const app = express();
const PORT = process.env.PORT || 5000;

// Global variables
let currentToken = null;
let tokenExpiry = null;

// Supported countries
const SUPPORTED_COUNTRIES = {
    'tr': 'Turkey',
    'us': 'United States', 
    'gb': 'United Kingdom',
    'de': 'Germany',
    'fr': 'France',
    'es': 'Spain',
    'it': 'Italy',
    'nl': 'Netherlands',
    'se': 'Sweden',
    'no': 'Norway',
    'dk': 'Denmark',
    'fi': 'Finland',
    'pl': 'Poland',
    'br': 'Brazil',
    'mx': 'Mexico',
    'ar': 'Argentina',
    'ca': 'Canada',
    'au': 'Australia',
    'jp': 'Japan',
    'kr': 'South Korea'
};

async function getSpotifyAccessToken() {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
        console.log("❌ SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables must be set");
        return null;
    }
    
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    try {
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: 'POST',
            headers: {
                "Authorization": `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: "grant_type=client_credentials"
        });
        
        if (response.ok) {
            const tokenData = await response.json();
            currentToken = tokenData.access_token;
            const expiresIn = tokenData.expires_in || 3600;
            tokenExpiry = new Date(Date.now() + (expiresIn - 60) * 1000);
            
            fs.writeFileSync("token.txt", currentToken);
            
            console.log(`✅ Token refreshed at ${new Date().toISOString()}`);
            return currentToken;
        } else {
            console.log(`❌ Failed to get token: ${response.status}`);
            return null;
        }
    } catch (error) {
        console.log(`❌ Error getting token: ${error}`);
        return null;
    }
}

async function searchSpotifyTrack(query, market = null) {
    if (!currentToken || (tokenExpiry && new Date() >= tokenExpiry)) {
        await getSpotifyAccessToken();
    }
    
    if (!currentToken) {
        return null;
    }
    
    const params = new URLSearchParams({
        q: query,
        type: 'track',
        limit: '5'
    });
    
    if (market) {
        params.append('market', market.toUpperCase());
    }
    
    try {
        const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
            headers: {
                "Authorization": `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            return await response.json();
        } else {
            console.log(`❌ Search failed: ${response.status}`);
            return null;
        }
    } catch (error) {
        console.log(`❌ Search error: ${error}`);
        return null;
    }
}

function extractTrackId(spotifyUrl) {
    if (spotifyUrl.includes("open.spotify.com/track/")) {
        return spotifyUrl.split("/track/")[1].split("?")[0];
    }
    return null;
}

// Routes
app.get('/', (req, res) => {
    res.send(`
    <html>
    <head>
        <title>Spotify Track Search</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
            h1 { color: #1db954; }
            .search-form { margin: 20px 0; }
            input[type="text"] { width: 70%; padding: 10px; font-size: 16px; }
            button { padding: 10px 20px; font-size: 16px; background: #1db954; color: white; border: none; cursor: pointer; }
            .example { color: #666; font-size: 14px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎵 Spotify Track Search</h1>
            <div class="search-form">
                <p>Search for tracks and get embed codes:</p>
                <p class="example">Examples:</p>
                <ul class="example">
                    <li><a href="/song/melis fis yalan">melis fis yalan</a></li>
                    <li><a href="/song/tak tak tak?location=tr">tak tak tak (Turkey)</a></li>
                    <li><a href="/view/billie eilish?location=us">billie eilish (US view)</a></li>
                </ul>
                <p><strong>API Endpoints:</strong></p>
                <ul>
                    <li><code>/song/&lt;query&gt;?location=&lt;country&gt;</code> - Returns JSON with embed code</li>
                    <li><code>/view/&lt;query&gt;?location=&lt;country&gt;</code> - Shows embed player directly</li>
                    <li><code>/docs</code> - Supported country codes</li>
                </ul>
            </div>
        </div>
    </body>
    </html>
    `);
});

app.get('/docs', (req, res) => {
    const countryList = Object.entries(SUPPORTED_COUNTRIES)
        .map(([code, name]) => `<li><code>${code}</code> - ${name}</li>`)
        .join('');
    
    res.send(`
    <html>
    <head>
        <title>API Documentation</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
            h1 { color: #1db954; }
            code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📚 API Documentation</h1>
            
            <h2>Endpoints</h2>
            <ul>
                <li><code>/song/&lt;query&gt;</code> - Search and get JSON response with embed code</li>
                <li><code>/view/&lt;query&gt;</code> - View embed player directly</li>
                <li><code>/docs</code> - This documentation page</li>
            </ul>
            
            <h2>Location Parameter</h2>
            <p>Add <code>?location=&lt;country_code&gt;</code> to get region-specific results.</p>
            
            <h2>Supported Country Codes</h2>
            <ul>
                ${countryList}
            </ul>
            
            <h2>Examples</h2>
            <ul>
                <li><a href="/song/melis fis?location=tr">/song/melis fis?location=tr</a></li>
                <li><a href="/view/taylor swift?location=us">/view/taylor swift?location=us</a></li>
            </ul>
            
            <p><a href="/">← Back to Home</a></p>
        </div>
    </body>
    </html>
    `);
});

app.get('/song/*', async (req, res) => {
    const query = req.params[0];
    const location = req.query.location?.toLowerCase();
    
    if (location && !SUPPORTED_COUNTRIES[location]) {
        return res.status(400).json({
            error: `Unsupported location: ${location}`,
            supported_locations: Object.keys(SUPPORTED_COUNTRIES)
        });
    }
    
    const searchResults = await searchSpotifyTrack(query, location);
    
    if (!searchResults || !searchResults.tracks?.items?.length) {
        return res.status(404).json({
            error: "No tracks found",
            query: query,
            location: location || "global"
        });
    }
    
    const firstTrack = searchResults.tracks.items[0];
    const spotifyUrl = firstTrack.external_urls.spotify;
    const trackId = extractTrackId(spotifyUrl);
    
    if (!trackId) {
        return res.status(500).json({
            error: "Could not extract track ID",
            query: query
        });
    }
    
    const embedCode = `<iframe data-testid="embed-iframe" style="border-radius:12px" src="https://open.spotify.com/embed/track/${trackId}?utm_source=generator" width="100%" height="152" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
    
    res.json({
        query: query,
        location: location || "global",
        track_name: firstTrack.name,
        artist_name: firstTrack.artists[0].name,
        spotify_url: spotifyUrl,
        track_id: trackId,
        embed_code: embedCode
    });
});

app.get('/view/*', async (req, res) => {
    const query = req.params[0];
    const location = req.query.location?.toLowerCase();
    
    if (location && !SUPPORTED_COUNTRIES[location]) {
        return res.send(`
        <html>
        <head><title>Unsupported Location</title></head>
        <body style="background: black; color: white; font-family: Arial; text-align: center; padding: 50px;">
            <h1>❌ Unsupported location: ${location}</h1>
            <p>Supported locations: ${Object.keys(SUPPORTED_COUNTRIES).join(', ')}</p>
            <a href="/" style="color: #1db954;">← Back to Search</a>
        </body>
        </html>
        `);
    }
    
    const searchResults = await searchSpotifyTrack(query, location);
    
    if (!searchResults || !searchResults.tracks?.items?.length) {
        return res.send(`
        <html>
        <head><title>Track Not Found</title></head>
        <body style="background: black; color: white; font-family: Arial; text-align: center; padding: 50px;">
            <h1>❌ No tracks found for "${query}"</h1>
            ${location ? `<p>Location: ${SUPPORTED_COUNTRIES[location] || location}</p>` : ''}
            <a href="/" style="color: #1db954;">← Back to Search</a>
        </body>
        </html>
        `);
    }
    
    const firstTrack = searchResults.tracks.items[0];
    const spotifyUrl = firstTrack.external_urls.spotify;
    const trackId = extractTrackId(spotifyUrl);
    
    if (!trackId) {
        return res.send(`
        <html>
        <head><title>Error</title></head>
        <body style="background: black; color: white; font-family: Arial; text-align: center; padding: 50px;">
            <h1>❌ Could not extract track ID</h1>
            <a href="/" style="color: #1db954;">← Back to Search</a>
        </body>
        </html>
        `);
    }
    
    res.send(`
    <html>
    <head>
        <title>${firstTrack.name} - ${firstTrack.artists[0].name}</title>
        <style>
            body { 
                background: black; 
                margin: 0; 
                padding: 0; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh;
                font-family: Arial, sans-serif;
            }
            .player-container { 
                text-align: center;
                width: 90%;
                max-width: 600px;
            }
            .track-info { 
                color: white; 
                margin-bottom: 20px; 
            }
            .back-link { 
                position: fixed; 
                top: 20px; 
                left: 20px; 
                color: #1db954; 
                text-decoration: none; 
                font-weight: bold; 
            }
            .location-info {
                color: #1db954;
                font-size: 14px;
                margin-bottom: 10px;
            }
        </style>
    </head>
    <body>
        <a href="/" class="back-link">← Back to Search</a>
        <div class="player-container">
            <div class="track-info">
                ${location ? `<div class="location-info">🌍 ${SUPPORTED_COUNTRIES[location] || "Global"}</div>` : ''}
                <h2>${firstTrack.name}</h2>
                <p>by ${firstTrack.artists[0].name}</p>
            </div>
            <iframe data-testid="embed-iframe" 
                    style="border-radius:12px" 
                    src="https://open.spotify.com/embed/track/${trackId}?utm_source=generator" 
                    width="100%" 
                    height="152" 
                    frameBorder="0" 
                    allowfullscreen="" 
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                    loading="lazy">
            </iframe>
        </div>
    </body>
    </html>
    `);
});

// Schedule token refresh every hour
cron.schedule('0 * * * *', () => {
    console.log('🔄 Scheduled token refresh...');
    getSpotifyAccessToken();
});

// Initialize and start server
async function startServer() {
    console.log("🎵 Starting Spotify Web API Service...");
    
    await getSpotifyAccessToken();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    });
}

startServer();
