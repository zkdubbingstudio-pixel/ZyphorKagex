const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express();

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

// Watch Details API Route
app.get('/api/get-watch-token', async (req, res) => {
    const { episodeId, userId } = req.query;

    try {
        const { data: episode, error } = await supabase
            .from('episodes')
            .select('*')
            .eq('id', episodeId)
            .single();

        if (error || !episode) {
            return res.json({ success: false, message: "Episode not found" });
        }

        const token = Buffer.from(`${episodeId}_${userId}_${Date.now()}`).toString('base64');

        res.json({
            success: true,
            token: token,
            episode: episode
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
