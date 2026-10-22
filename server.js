const { createClient } = require('@supabase/supabase-js');

// Supabase Connection Init
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Episode Publish Route (Database mein Save karne ke liye)
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

// 2. Token & Watch Details Route (Database se data lane ke liye)
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

        // Token generate karke response dein
        const token = generateTemporaryToken(episodeId, userId);

        res.json({
            success: true,
            token: token,
            episode: episode
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
