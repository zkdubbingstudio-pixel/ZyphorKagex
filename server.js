// Token generate karne ke liye endpoint
app.get('/api/get-watch-token', async (req, res) => {
    const { episodeId, userId } = req.query;

    if (!episodeId || !userId) {
        return res.json({ success: false, message: "Missing parameters" });
    }

    try {
        // Episode check
        const { data: episode, error: epError } = await supabase
            .from('episodes')
            .select('*')
            .eq('id', episodeId)
            .single();

        if (epError || !episode) {
            return res.json({ success: false, message: "Episode not found" });
        }

        // Unique token generate
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

// Watch page stream validate and usage count update
app.get('/api/validate-token', async (req, res) => {
    const { token } = req.query;

    if (!token) return res.json({ success: false, message: "Token missing" });

    try {
        const { data: tokData, error } = await supabase
            .from('episode_tokens')
            .select('*, episodes(*)')
            .eq('token', token)
            .single();

        if (error || !tokData) {
            return res.json({ success: false, message: "Invalid or expired link!" });
        }

        // Expiry check (5 min)
        if (new Date() > new Date(tokData.expires_at)) {
            return res.json({ success: false, message: "⏰ Link expired (5 minutes timeout)!" });
        }

        // Max use check (2 times limit)
        if (tokData.uses_count >= tokData.max_uses) {
            return res.json({ success: false, message: "🚫 Limit exceeded! This link was used 2 times already." });
        }

        // Increment usage count
        await supabase
            .from('episode_tokens')
            .update({ uses_count: tokData.uses_count + 1 })
            .eq('token', token);

        res.json({
            success: true,
            video_url: tokData.episodes.video_url,
            remaining_uses: tokData.max_uses - (tokData.uses_count + 1)
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
