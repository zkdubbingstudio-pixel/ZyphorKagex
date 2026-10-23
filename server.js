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

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

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

// Publish a new episode
app.post('/api/episodes', async (req, res) => {
    try {
        const { animeName, episodeNumber, title, videoUrl } = req.body;
        const episodeId = 'ep_' + Date.now();
        const insertData = {
            id: episodeId,
            anime_name: animeName || 'Anime',
            episode_number: episodeNumber || '1',
            title: title || '',
            video_url: videoUrl || ''
        };

        const { error } = await supabase.from('episodes').insert([insertData]);
        if (error) throw error;
        
        res.json({ success: true, message: "Episode published successfully!", episodeId: episodeId });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update an existing episode
app.put('/api/episodes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { animeName, episodeNumber, title, videoUrl } = req.body;
        
        const { error } = await supabase.from('episodes').update({
            anime_name: animeName,
            episode_number: episodeNumber,
            title: title,
            video_url: videoUrl
        }).eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: "Episode updated successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete an episode
app.delete('/api/episodes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('episodes').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true, message: "Episode deleted successfully!" });
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
            videoUrl: episode.video_url,
            userId: tRecord.user_id
        });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
