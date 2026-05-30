/**
 * Express Server Entry Point
 * Simple wrapper around the ApiService
 */

import { apiService } from '../services/api.service';

const PORT = parseInt(process.env.PORT || '3000', 10);

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    console.log('Starting FileMaker DDR Analysis Server...');
    await apiService.start(PORT);
    console.log(`Server successfully started on port ${PORT}`);

    // Graceful shutdown handlers
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
function gracefulShutdown(signal: string): void {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  // Give a brief moment for cleanup
  setTimeout(() => {
    console.log('Server shut down complete.');
    process.exit(0);
  }, 1000);
}

// Start the server if this file is executed directly
if (require.main === module) {
  startServer().catch(console.error);
}

export { startServer };
