const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express(); // Express App Initialization

app.use(express.json());
app.use(cors());

// Static files (Jaise Admin panel, Watch page, HTML/CSS ke liye)
app.use(express.static(path.join(__dirname, 'public')));

// Supabase Connection Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Supabase URL or Key is missing in Environment Variables!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Episode Publish Route (Database mein save karne ke liye)
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
                    title: title,
                    video_url: videoUrl
                }
            ]);

        if (error) throw error;

        res.json({
            success: true,
            episodeId: episodeId,
            streamPath: `/watch.html?id=${episodeId}`
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Token & Watch Details Route (Database se data fetch karne ke liye)
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

        // Simple Temporary Token Generator logic
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

// Server Port Setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running smoothly on port ${PORT}`);
});
