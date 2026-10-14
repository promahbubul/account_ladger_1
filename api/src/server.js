import { createApp } from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const app = createApp();
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[HisabFlow API] Running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
