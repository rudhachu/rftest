const fs = require('fs');
const path = require('path');
const { writeFileSync } = require('fs');
const axios = require('axios');

async function MakeSession(sessionId, folderPath = './session/') {
  const outputPath = path.join(folderPath, "creds.json");

  const replacementPatterns = [
    'Rudhra~rUd0hRaArH3dur',
    'Rudhra~RuD0rAaRh3DuR',
    'Rudhra~ArH0durRUd3rA',
    'Rudhra~aRh0DuRrUd3hRa'
  ];

  let PasteId = sessionId;
  replacementPatterns.forEach(pattern => {
    PasteId = PasteId.replace(pattern, '');
  });

  const pastebinUrl = `https://pastebin.com/raw/${PasteId}`;
  console.log(`PASTE URL: ${pastebinUrl}`);

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  try {
    const response = await axios.get(pastebinUrl);

    if (response.data) {
      const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

      if (fs.existsSync(outputPath)) {
        console.log('File already exists. Overwriting...');
      }

      writeFileSync(outputPath, data);
      console.log('Session ID loaded successfully:', outputPath);
    } else {
      console.error('No data received from Pastebin.');
    }

  } catch (error) {
    console.error('Error loading session ID from Pastebin:', error.message);
  }
}

module.exports = { MakeSession };
