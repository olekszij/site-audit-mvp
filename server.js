const app = require('./app');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Site Audit MVP запущен на http://localhost:' + PORT);
});
