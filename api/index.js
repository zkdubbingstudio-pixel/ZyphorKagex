const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL || "https://knefbynsdhgjuhlklyvu.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_tZxPCR45AXkjm73Fq81YAQ_VHEsGZVJ";
const BOT_TOKEN = process.env.BOT_TOKEN || "8934334004:AAESWVI3LqraM8eztb9tJldPOkzXGn0tI2c";
const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || "6144546817,8528056660")
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

function normalizeServersList(videoUrlInput, serversInput) {
    let rawList = [];

    if (Array.isArray(serversInput)) {
        rawList = serversInput;
    } else if (Array.isArray(videoUrlInput)) {
        rawList = videoUrlInput;
    } else if (typeof videoUrlInput === 'string') {
        const trimmed = videoUrlInput.trim();
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) rawList = parsed;
            } catch (_) {
                rawList = [trimmed];
            }
        } else if (trimmed) {
            rawList = [trimmed];
        }
    }

    return rawList
        .map((item, idx) => {
            if (typeof item === 'string') {
                const url = item.trim();
                return url ? { name: `Server ${idx + 1}`, url } : null;
            }
            if (item && typeof item === 'object') {
                const url = (item.url || '').toString().trim();
                const name = (item.name || `Server ${idx + 1}`).toString().trim();
                return url ? { name, url } : null;
            }
            return null;
        })
        .filter(Boolean);
}

app.get('/api', (req, res) => {
    res.json({ status: "ok", message: "Vercel Backend & Stream API is Active!" });
});

// 1. Get all published episodes for Admin Panel
app.get('/api/episodes', async (req, res) => {
    try {
        const headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`
        };
        const response = await fetch(`${SUPABASE_URL}/rest/v1/episodes?select=*&order=created_at.desc`, { headers });
        const data = await response.json();
        res.status(response.ok ? 200 : 500).json(data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Publish new episode endpoint (POST)
app.post('/api/episodes', async (req, res) => {
    try {
        const { animeName, episodeNumber, title, videoUrl, servers, adLink } = req.body;
        const epId = "ep_" + Date.now();

        const serverList = normalizeServersList(videoUrl, servers);
        if (serverList.length === 0) {
            return res.status(400).json({ success: false, error: "At least one valid video URL is required." });
        }

        const storedVideoValue = serverList.length > 1
            ? JSON.stringify(serverList.map(s => s.url))
            : serverList[0].url;

        const headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        };

        const payload = {
            id: epId,
            anime_name: animeName,
            episode_number: episodeNumber,
            title: title || null,
            video_url: storedVideoValue,
            ad_link: adLink || null
        };

        const response = await fetch(`${SUPABASE_URL}/rest/v1/episodes`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            res.json({ success: true, id: epId, servers: serverList, message: "Episode published successfully!" });
        } else {
            const err = await response.text();
            res.json({ success: false, error: err });
        }
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 3. Episode Update (Edit) Endpoint (PUT)
app.put('/api/episodes/:id', async (req, res) => {
    try {
        const episodeId = req.params.id;
        const { animeName, episodeNumber, title, videoUrl, servers, adLink } = req.body;

        const serverList = normalizeServersList(videoUrl, servers);
        if (serverList.length === 0) {
            return res.status(400).json({ success: false, error: "At least one valid video URL is required." });
        }

        const storedVideoValue = serverList.length > 1
            ? JSON.stringify(serverList.map(s => s.url))
            : serverList[0].url;

        const headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        };

        const updatePayload = {
            anime_name: animeName,
            episode_number: episodeNumber,
            title: title || null,
            video_url: storedVideoValue
        };
        if (adLink !== undefined) {
            updatePayload.ad_link = adLink;
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/episodes?id=eq.${episodeId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(updatePayload)
        });

        if (response.ok) {
            res.json({ success: true, servers: serverList, message: "Episode updated successfully!" });
        } else {
            const err = await response.text();
            res.json({ success: false, error: err });
        }
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 4. Episode Delete Endpoint (DELETE)
app.delete('/api/episodes/:id', async (req, res) => {
    try {
        const episodeId = req.params.id;
        const headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Prefer": "return=minimal"
        };

        const response = await fetch(`${SUPABASE_URL}/rest/v1/episodes?id=eq.${episodeId}`, {
            method: 'DELETE',
            headers
        });

        if (response.ok || response.status === 204) {
            res.json({ success: true, message: "Episode deleted successfully!" });
        } else {
            const err = await response.text();
            res.json({ success: false, error: err });
        }
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 5. Token Generate Endpoint
app.get('/api/get-watch-token', async (req, res) => {
    try {
        const episodeId = req.query.episodeId;
        const userId = req.query.userId;

        if (!episodeId || !userId) {
            return res.status(400).json({ success: false, message: "Missing parameters" });
        }

        const token = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        const payload = {
            token: token,
            episode_id: episodeId,
            user_id: String(userId),
            uses: 0,
            expires_at: expiresAt
        };

        const response = await fetch(`${SUPABASE_URL}/rest/v1/episode_tokens`, {
            method: 'POST',
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            return res.json({ success: true, token: token });
        } else {
            const errText = await response.text();
            return res.status(500).json({ success: false, message: "Database error: " + errText });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// 6. Token Verify Endpoint (Mini App Only, User-Lock, Single-Use & Security Alert)
app.get('/api/verify-token', async (req, res) => {
    try {
        const token = req.query.token;
        const incomingUserId = (req.query.userId || "").toString().trim();
        const initDataHeader = (req.headers["x-telegram-init-data"] || "").toString().trim();

        if (!token) {
            return res.status(400).json({ success: false, message: "Token missing" });
        }

        if (!initDataHeader && (!incomingUserId || incomingUserId === "undefined")) {
            return res.status(403).json({
                success: false,
                message: "Yeh episode sirf Telegram Mini App ke andar hi chal sakta hai."
            });
        }

        const headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`
        };

        const fetchRes = await fetch(`${SUPABASE_URL}/rest/v1/episode_tokens?token=eq.${token}&select=*`, { headers });
        const data = await fetchRes.json();

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid or expired token!" });
        }

        const tokenData = data[0];
        const uses = tokenData.uses || 0;
        const expiresAt = new Date(tokenData.expires_at);
        const originalUserId = String(tokenData.user_id);

        if (incomingUserId && incomingUserId !== "" && incomingUserId !== "undefined" && incomingUserId !== originalUserId) {
            const alertText = `🚨 *Security Alert: Leak / Bypass Attempt Detected!*\n\n👤 Original Owner ID: \`${originalUserId}\`\n🚫 Unauthorized User ID: \`${incomingUserId}\`\n🔗 Episode ID: \`${tokenData.episode_id}\``;

            for (const adminId of ADMIN_TELEGRAM_IDS) {
                fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: adminId, text: alertText, parse_mode: "Markdown" })
                }).catch(err => console.log("Alert send error:", err));
            }

            return res.status(400).json({ success: false, message: "Yeh link kisi aur user ke liye generate ki gayi hai! Aap ise use nahi kar sakte." });
        }

        if (uses >= 1) {
            return res.status(400).json({ success: false, message: "Yeh link pehle hi use ho chuki hai aur ab expire ho gayi hai!" });
        }

        if (new Date() > expiresAt) {
            return res.status(400).json({ success: false, message: "Token time expired!" });
        }

        const epRes = await fetch(`${SUPABASE_URL}/rest/v1/episodes?id=eq.${tokenData.episode_id}&select=video_url`, { headers });
        const epData = await epRes.json();
        const rawVideoValue = (epData && epData.length > 0) ? epData[0].video_url : "";
        const servers = normalizeServersList(rawVideoValue, null);
        const videoUrl = servers.length > 0 ? servers[0].url : "";

        await fetch(`${SUPABASE_URL}/rest/v1/episode_tokens?token=eq.${token}`, {
            method: 'PATCH',
            headers: {
                ...headers,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ uses: uses + 1 })
        });

        return res.json({
            success: true,
            episodeId: tokenData.episode_id,
            userId: tokenData.user_id,
            videoUrl: videoUrl,
            servers: servers
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = app;
