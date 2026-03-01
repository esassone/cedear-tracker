import axios from 'axios';
import fs from 'fs';

async function dump() {
  const ticker = 'AAPL';
  const { data } = await axios.get(`https://finance.yahoo.com/quote/${ticker}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  fs.writeFileSync('yahoo_aapl.html', data);
  console.log('Dumped to yahoo_aapl.html');
}

dump();
