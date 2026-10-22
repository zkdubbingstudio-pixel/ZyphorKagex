const express = require('express');
const app = express();
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

app.use(express.json());
app.use(cors());

// Static Files setup for Public folder
app.use(express.static(path.join(__dirname, 'public')));

// Direct Route for /admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Supabase URL or Key is missing in Environment Variables!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Publish Episode API Route
app.post('/api/publish-episode', async (req, res) => {
    const { animeName, episodeNumber, title, videoUrl } = req.body;
    const episodeId = `ep_${Date.now()}`;

    try {
        const { data, error } = await supabase
            .from('episodes')
            .insert([
                {
                    id: episodeId,
                    anime_name: animeName,
                    episode_number: episodeNumber,
                    title: title || '',
                    video_url: videoUrl
                }
            ]);

        if (error) {
            console.error("Supabase Error:", error);
            return res.status(400).json({ success: false, message: error.message });
        }

        res.json({
            success: true,
            episodeId: episodeId,
            streamPath: `/watch.html?id=${episodeId}`
        });
    } catch (err) {
        console.error("Server Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Token Generate API Route (5 mins expiry, 2 max uses)
app.get('/api/get-watch-token', async (req, res) => {
    const { episodeId, userId } = req.query;

    if (!episodeId || !userId) {
        return res.json({ success: false, message: "Missing parameters" });
    }

    try {
        const { data: episode, error: epError } = await supabase
            .from('episodes')
            .select('*')
            .eq('id', episodeId)
            .single();

        if (epError || !episode) {
            return res.json({ success: false, message: "Episode not found" });
        }

        const token = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 Minutes Expiry

        // Save Token in Supabase
        await supabase.from('episode_tokens').insert([
            {
                token: token,
                episode_id: episodeId,
                user_id: userId,
                uses_count: 0,
                max_uses: 2,
                expires_at: expiresAt
            }
        ]);

        res.json({
            success: true,
            token: token,
            episode: episode
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Watch page stream validate and usage count update API Route (Foreign Key independent)
app.get('/api/validate-token', async (req, res) => {
    const { token } = req.query;

    if (!token) return res.json({ success: false, message: "Token missing" });

    try {
        // 1. Fetch token data
        const { data: tokData, error: tokError } = await supabase
            .from('episode_tokens')
            .select('*')
            .eq('token', token)
            .single();

        if (tokError || !tokData) {
            return res.json({ success: false, message: "Invalid or expired link!" });
        }

        // 2. Expiry check (5 min)
        if (new Date() > new Date(tokData.expires_at)) {
            return res.json({ success: false, message: "⏰ Link expired (5 minutes timeout)!" });
        }

        // 3. Max use check (2 times limit)
        if (tokData.uses_count >= tokData.max_uses) {
            return res.json({ success: false, message: "🚫 Limit exceeded! This link was used 2 times already." });
        }

        // 4. Fetch episode details separately
        const { data: episode, error: epError } = await supabase
            .from('episodes')
            .select('*')
            .eq('id', tokData.episode_id)
            .single();

        if (epError || !episode) {
            return res.json({ success: false, message: "Episode associated with token not found!" });
        }

        // 5. Increment usage count
        await supabase
            .from('episode_tokens')
            .update({ uses_count: tokData.uses_count + 1 })
            .eq('token', token);

        res.json({
            success: true,
            video_url: episode.video_url,
            remaining_uses: tokData.max_uses - (tokData.uses_count + 1)
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
