const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Explicit Route for Admin Panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Explicit Route for Watch Page
app.get('/watch', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'watch.html'));
});

app.get('/', (req, res) => {
    res.send("ZK Dubbing Studio Backend is Live!");
});

// Fetch all episodes
app.get('/api/episodes', async (req, res) => {
    try {
        const { data, error } = await supabase.from('episodes').select('*');
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Publish a new episode from Admin Panel
app.post('/api/episodes', async (req, res) => {
    try {
        const { animeName, anime_name, episodeNumber, episode_number, title, videoUrl, video_url } = req.body;
        
        const episodeId = 'ep_' + Date.now();
        const insertData = {
            id: episodeId,
            anime_name: animeName || anime_name || 'Anime',
            episode_number: episodeNumber || episode_number || '1',
            title: title || '',
            video_url: videoUrl || video_url || ''
        };

        const { data, error } = await supabase.from('episodes').insert([insertData]);
        if (error) throw error;
        
        res.json({ success: true, message: "Episode published successfully!", episodeId: episodeId });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/get-watch-token', async (req, res) => {
    const { episodeId, userId } = req.query;
    if (!episodeId || !userId) {
        return res.json({ success: false, message: "Missing episodeId or userId" });
    }
    try {
        const { data: epData, error: epError } = await supabase.from('episodes').select('*').eq('id', episodeId);
        if (epError || !epData.length) {
            return res.json({ success: false, message: "Episode not found." });
        }

        const token = crypto.randomBytes(16).toString('hex');
        const { error: insertError } = await supabase.from('episode_tokens').insert([
            { token: token, episode_id: episodeId, user_id: String(userId) }
        ]);

        if (insertError) {
            return res.json({ success: false, message: "DB Insert failed: " + insertError.message });
        }

        res.json({ success: true, token: token });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

app.get('/api/verify-token', async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.json({ success: false, message: "Token missing" });
    }
    try {
        const { data: tokenData, error: tokenError } = await supabase.from('episode_tokens').select('*').eq('token', token);
        if (tokenError || !tokenData.length) {
            return res.json({ success: false, message: "Invalid or expired token!" });
        }

        const tRecord = tokenData[0];
        const { data: epData, error: epError } = await supabase.from('episodes').select('*').eq('id', tRecord.episode_id);
        if (epError || !epData.length) {
            return res.json({ success: false, message: "Episode not found!" });
        }

        const episode = epData[0];
        res.json({
            success: true,
            videoUrl: episode.video_url || episode.videoUrl,
            userId: tRecord.user_id
        });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
