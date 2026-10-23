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

// Get all episodes for Admin Panel List
app.get('/api/episodes', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('episodes')
            .select('*')
            .order('episode_number', { ascending: true });

        if (error) return res.status(400).json({ success: false, message: error.message });
        res.json({ success: true, episodes: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Episode API Route
app.put('/api/update-episode', async (req, res) => {
    const { id, animeName, episodeNumber, title, videoUrl } = req.body;
    try {
        const { error } = await supabase
            .from('episodes')
            .update({
                anime_name: animeName,
                episode_number: episodeNumber,
                title: title || '',
                video_url: videoUrl
            })
            .eq('id', id);

        if (error) return res.status(400).json({ success: false, message: error.message });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete Episode API Route
app.delete('/api/delete-episode', async (req, res) => {
    const { id } = req.query;
    try {
        const { error } = await supabase
            .from('episodes')
            .delete()
            .eq('id', id);

        if (error) return res.status(400).json({ success: false, message: error.message });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Token Generate API Route
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
            console.error("Episode fetch error:", epError);
            return res.json({ success: false, message: "Episode not found" });
        }

        const token = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 Mins Expiry

        const { error: insertError } = await supabase.from('episode_tokens').insert([
            {
                token: token,
                episode_id: episodeId,
                user_id: String(userId),
                uses_count: 0,
                max_uses: 20,
                expires_at: expiresAt
            }
        ]);

        if (insertError) {
            console.error("Token Insert Error:", insertError);
            return res.json({ success: false, message: "DB Insert Failed: " + insertError.message });
        }

        res.json({
            success: true,
            token: token,
            episode: episode
        });
    } catch (err) {
        console.error("Get Token Exception:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Watch page stream validate API Route
app.get('/api/validate-token', async (req, res) => {
    const { token } = req.query;

    if (!token) return res.json({ success: false, message: "Token missing" });

    try {
        const { data: tokData, error: tokError } = await supabase
            .from('episode_tokens')
            .select('*')
            .eq('token', token)
            .single();

        if (tokError || !tokData) {
            console.error("Token validation lookup error:", tokError);
            return res.json({ success: false, message: "Invalid or expired link!" });
        }

        if (new Date() > new Date(tokData.expires_at)) {
            return res.json({ success: false, message: "⏰ Link expired! Please get a new link from channel." });
        }

        if (tokData.uses_count >= tokData.max_uses) {
            return res.json({ success: false, message: "🚫 Limit exceeded! Please request a new link." });
        }

        const { data: episode, error: epError } = await supabase
            .from('episodes')
            .select('*')
            .eq('id', tokData.episode_id)
            .single();

        if (epError || !episode) {
            console.error("Episode lookup error for token:", epError);
            return res.json({ success: false, message: "Episode associated with token not found!" });
        }

        await supabase
            .from('episode_tokens')
            .update({ uses_count: tokData.uses_count + 1 })
            .eq('token', token);

        res.json({
            success: true,
            video_url: episode.video_url
        });
    } catch (err) {
        console.error("Validate Token Exception:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
