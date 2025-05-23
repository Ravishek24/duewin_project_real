// routes/testRoutes.js
const express = require('express');
const router = express.Router();

// A simple test route to embed the game in an iframe
router.get('/game-test', (req, res) => {
  const { gameUrl } = req.query;
  
  if (!gameUrl) {
    return res.status(400).send('Game URL is required as a query parameter');
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Game Test</title>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          overflow: hidden;
        }
        .game-container {
          width: 100%;
          height: 100vh;
          border: none;
        }
      </style>
    </head>
    <body>
      <iframe src="${gameUrl}" class="game-container" allowfullscreen></iframe>
    </body>
    </html>
  `;
  
  res.send(html);
});

// Direct redirect to game URL
router.get('/game-redirect', (req, res) => {
  const { gameUrl } = req.query;
  
  if (!gameUrl) {
    return res.status(400).send('Game URL is required as a query parameter');
  }
  
  // Direct redirect to the game URL
  res.redirect(gameUrl);
});

module.exports = router; 