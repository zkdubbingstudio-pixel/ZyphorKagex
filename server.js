const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SUPABASE_URL = "https://knefbynsdhgjuhlklyvu.supabase.co";
const SUPABASE_KEY = "sb_publishable_tZxPCR45AXkjm73Fq81YAQ_VHEsGZVJ";
const BOT_TOKEN = "8934334004:AAESWVI3LqraM8eztb9tJldPOkzXGn0tI2c";
const ADMIN_TELEGRAM_IDS = ["6144546817", "8528056660"];

app.get('/', (req, res) => {
    res.send("Render Backend & Stream Server is Active!");
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
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Publish new episode endpoint (POST)
app.post('/api/episodes', async (req, res) => {
    try {
        const { animeName, episodeNumber, title, videoUrl, adLink } = req.body;
        // Generate a unique episode id if not present
        const epId = "ep_" + Date.now();

        const headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        };
        const response = await fetch(`${SUPABASE_URL}/rest/v1/episodes`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ 
                id: epId, 
                anime_name: animeName, 
                episode_number: episodeNumber, 
                title: title, 
                video_url: videoUrl, 
                ad_link: adLink || null 
            })
        });
        if (response.ok) {
            res.json({ success: true, message: "Episode published successfully!" });
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
        const { animeName, episodeNumber, title, videoUrl, adLink } = req.body;
        
        const headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        };
        const response = await fetch(`${SUPABASE_URL}/rest/v1/episodes?id=eq.${episodeId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ 
                anime_name: animeName, 
                episode_number: episodeNumber, 
                title: title, 
                video_url: videoUrl, 
                ...(adLink ? { ad_link: adLink } : {})
            })
        });
        if (response.ok) {
            res.json({ success: true, message: "Episode updated successfully!" });
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
            "Authorization": `Bearer ${SUPABASE_KEY}`
        };
        const response = await fetch(`${SUPABASE_URL}/rest/v1/episodes?id=eq.${episodeId}`, {
            method: 'DELETE',
            headers
        });
        if (response.ok) {
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

// 6. Token Verify Endpoint (User-Lock, Single-Use & Security Alert)
app.get('/api/verify-token', async (req, res) => {
    try {
        const token = req.query.token;
        const incomingUserId = req.query.userId;

        if (!token) {
            return res.status(400).json({ success: false, message: "Token missing" });
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

        // 🔒 USER-LOCK CHECK & ADMIN SECURITY ALERT
        if (incomingUserId && incomingUserId !== "" && incomingUserId !== "undefined" && incomingUserId !== originalUserId) {
            
            const alertText = `🚨 **Security Alert: Leak / Bypass Attempt Detected!**\n\n👤 Original Owner ID: \`${originalUserId}\`\n🚫 Unauthorized User ID: \`${incomingUserId}\`\n🔗 Episode ID: \`${tokenData.episode_id}\``;
            
            for (const adminId of ADMIN_TELEGRAM_IDS) {
                fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: adminId, text: alertText, parse_mode: "Markdown" })
                }).catch(err => console.log("Alert send error:", err));
            }

            return res.status(400).json({ success: false, message: "Yeh link kisi aur user ke liye generate ki gayi hai! Aap ise use nahi kar sakte." });
        }

        // Single-use check
        if (uses >= 1) {
            return res.status(400).json({ success: false, message: "Yeh link pehle hi use ho chuki hai aur ab expire ho gayi hai!" });
        }

        // Expiry check
        if (new Date() > expiresAt) {
            return res.status(400).json({ success: false, message: "Token time expired!" });
        }

        const epRes = await fetch(`${SUPABASE_URL}/rest/v1/episodes?id=eq.${tokenData.episode_id}&select=video_url`, { headers });
        const epData = await epRes.json();
        const videoUrl = (epData && epData.length > 0) ? epData[0].video_url : "";

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
            videoUrl: videoUrl
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
