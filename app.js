const path = require('path');
const express = require('express');
const { runAudit, normalizeUrl } = require('./audit');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Set views path - handle both local and Netlify environments
// In Netlify functions, __dirname points to netlify/functions/
const viewsPath = path.join(__dirname, 'views');
app.set('views', viewsPath);
console.log('Views directory:', viewsPath);
console.log('Current directory:', __dirname);

app.get('/', (req, res) => {
  res.render('index', { error: null, url: '' });
});

app.post('/audit', async (req, res) => {
  const submittedUrl = req.body.url || '';

  try {
    console.log('Starting audit for:', submittedUrl);
    const targetUrl = normalizeUrl(submittedUrl);
    console.log('Normalized URL:', targetUrl);
    
    const audit = await runAudit(targetUrl);
    console.log('Audit completed successfully');
    res.render('report', audit);
  } catch (error) {
    console.error('Audit error:', error);
    console.error('Error stack:', error.stack);
    
    // Return error as JSON for better debugging
    res.status(500).json({
      error: error.message || 'Failed to perform site audit.',
      details: error.stack,
      url: submittedUrl,
    });
  }
});

module.exports = app;
