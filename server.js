const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SUPABASE_URL = "https://knefbynsdhgjuhlklyvu.supabase.co";
const SUPABASE_KEY = "sb_publishable_tZxPCR45AXkjm73Fq81YAQ_VHEsGZVJ";

app.get('/', (req, res) => {
    res.send("Render Backend & Stream Server is Active!");
});

// 1. Token Generate Endpoint
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

// 2. Token Verify Endpoint (User-Lock & Single-Use Enforcement)
app.get('/api/verify-token', async (req, res) => {
    try {
        const token = req.query.token;
        const incomingUserId = req.query.userId; // Frontend se aaya hua User ID

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

        // 🔒 USER-LOCK CHECK: Agar koi doosra user link khole ya normal browser mein khole
        if (incomingUserId && String(incomingUserId) !== originalUserId) {
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

        // Increment uses to 1 immediately
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
.           userId: tokenData.user_id
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
