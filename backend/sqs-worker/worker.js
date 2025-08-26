const sqsService = require('../hospital-service/sqs-service');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'sqs-worker' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

class SQSWorker {
  constructor() {
    this.isRunning = false;
    this.processingInterval = null;
  }

  start() {
    if (this.isRunning) {
      logger.warn('Worker is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting SQS worker...');

    // Process messages every 30 seconds
    this.processingInterval = setInterval(async () => {
      try {
        await this.processMessages();
      } catch (error) {
        logger.error('Error in worker processing cycle', { error: error.message });
      }
    }, 30000);

    // Process immediately on start
    this.processMessages();
  }

  stop() {
    if (!this.isRunning) {
      logger.warn('Worker is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    logger.info('SQS worker stopped');
  }

  async processMessages() {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('Processing SQS messages...');
      
      const processedCount = await sqsService.processHospitalQueue();
      
      if (processedCount > 0) {
        logger.info(`Processed ${processedCount} messages`);
      }
      
    } catch (error) {
      logger.error('Failed to process messages', { error: error.message });
    }
  }
}

// Handle graceful shutdown
const worker = new SQSWorker();

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  worker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  worker.stop();
  process.exit(0);
});

// Start the worker
worker.start();

logger.info('SQS Worker started. Press Ctrl+C to stop.');

module.exports = SQSWorker;
