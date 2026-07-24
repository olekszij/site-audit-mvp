const path = require('path');
const express = require('express');
const { runAudit, normalizeUrl } = require('./audit');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  res.render('index', { error: null, url: '' });
});

app.post('/audit', async (req, res) => {
  const submittedUrl = req.body.url || '';

  try {
    const targetUrl = normalizeUrl(submittedUrl);
    const audit = await runAudit(targetUrl);
    res.render('report', audit);
  } catch (error) {
    res.status(500).render('index', {
      error: error.message || 'Не удалось выполнить аудит сайта.',
      url: submittedUrl,
    });
  }
});

module.exports = app;
