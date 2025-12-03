import fs from 'fs';
import JSONStream from 'JSONStream';

// Install: npm install JSONStream

// Get random items while streaming
const getRandomItems = (filePath, count) => {
  return new Promise((resolve, reject) => {
    const items = [];
    let totalCount = 0;
    
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(JSONStream.parse('*')); // Assumes it's an array at root
    
    stream.on('data', (item) => {
      totalCount++;
      
      // Reservoir sampling algorithm
      if (items.length < count) {
        items.push(item);
      } else {
        const randomIndex = Math.floor(Math.random() * totalCount);
        if (randomIndex < count) {
          items[randomIndex] = item;
        }
      }
    });
    
    stream.on('end', () => resolve(items));
    stream.on('error', reject);
  });
};

// Usage
getRandomItems('../data/agents.json', 10).then(items => {
  console.log('Random items:', items);
});
