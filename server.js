const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express(); // <--- Yeh hona zaroori hai!

app.use(express.json());
app.use(cors());

// Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Baaki aapke saare routes yahan aage aayenge:
app.post('/api/publish-episode', async (req, res) => {
    // ...
});

app.get('/api/get-watch-token', async (req, res) => {
    // ...
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
