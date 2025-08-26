const AWS = require('aws-sdk');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'sqs-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Configure SQS
const sqs = new AWS.SQS({
  region: process.env.AWS_REGION || 'us-west-2',
});

const HOSPITAL_PROCESSING_QUEUE = process.env.HOSPITAL_PROCESSING_QUEUE || 'hospital-processing-queue';
const NOTIFICATION_QUEUE = process.env.NOTIFICATION_QUEUE || 'hospital-notifications-queue';

class SQSService {
  
  /**
   * Send hospital for async processing
   */
  async queueHospitalProcessing(hospital, operation) {
    try {
      const message = {
        hospitalId: hospital.id,
        operation: operation, // 'create', 'update', 'delete'
        hospitalData: hospital,
        timestamp: new Date().toISOString(),
        processingType: 'validation'
      };

      const params = {
        QueueUrl: HOSPITAL_PROCESSING_QUEUE,
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
          'operation': {
            DataType: 'String',
            StringValue: operation
          },
          'hospitalId': {
            DataType: 'String',
            StringValue: hospital.id
          }
        }
      };

      const result = await sqs.sendMessage(params).promise();
      
      logger.info('Hospital queued for processing', {
        hospitalId: hospital.id,
        operation: operation,
        messageId: result.MessageId
      });

      return result.MessageId;
    } catch (error) {
      logger.error('Failed to queue hospital processing', {
        hospitalId: hospital.id,
        operation: operation,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send notification for hospital events
   */
  async queueNotification(hospitalId, eventType, recipients) {
    try {
      const message = {
        hospitalId: hospitalId,
        eventType: eventType, // 'created', 'updated', 'deleted'
        recipients: recipients,
        timestamp: new Date().toISOString(),
        priority: 'normal'
      };

      const params = {
        QueueUrl: NOTIFICATION_QUEUE,
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
          'eventType': {
            DataType: 'String',
            StringValue: eventType
          },
          'priority': {
            DataType: 'String',
            StringValue: 'normal'
          }
        }
      };

      const result = await sqs.sendMessage(params).promise();
      
      logger.info('Notification queued', {
        hospitalId: hospitalId,
        eventType: eventType,
        messageId: result.MessageId
      });

      return result.MessageId;
    } catch (error) {
      logger.error('Failed to queue notification', {
        hospitalId: hospitalId,
        eventType: eventType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process messages from hospital processing queue
   */
  async processHospitalQueue() {
    try {
      const params = {
        QueueUrl: HOSPITAL_PROCESSING_QUEUE,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        VisibilityTimeoutSeconds: 300
      };

      const result = await sqs.receiveMessage(params).promise();
      
      if (result.Messages) {
        for (const message of result.Messages) {
          await this.processHospitalMessage(message);
        }
      }

      return result.Messages ? result.Messages.length : 0;
    } catch (error) {
      logger.error('Failed to process hospital queue', { error: error.message });
      throw error;
    }
  }

  /**
   * Process individual hospital message
   */
  async processHospitalMessage(message) {
    try {
      const messageBody = JSON.parse(message.Body);
      const { hospitalId, operation, hospitalData } = messageBody;

      logger.info('Processing hospital message', {
        hospitalId: hospitalId,
        operation: operation,
        receiptHandle: message.ReceiptHandle
      });

      // Simulate async processing
      await this.validateHospitalData(hospitalData);
      await this.updateHospitalStatus(hospitalId, 'processed');

      // Delete message after successful processing
      await sqs.deleteMessage({
        QueueUrl: HOSPITAL_PROCESSING_QUEUE,
        ReceiptHandle: message.ReceiptHandle
      }).promise();

      logger.info('Hospital message processed successfully', {
        hospitalId: hospitalId,
        operation: operation
      });

    } catch (error) {
      logger.error('Failed to process hospital message', {
        messageId: message.MessageId,
        error: error.message
      });
      // Message will be retried due to visibility timeout
    }
  }

  /**
   * Validate hospital data asynchronously
   */
  async validateHospitalData(hospitalData) {
    // Simulate validation logic
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!hospitalData.name || !hospitalData.address) {
      throw new Error('Invalid hospital data: missing required fields');
    }

    logger.info('Hospital data validated', { hospitalId: hospitalData.id });
  }

  /**
   * Update hospital processing status
   */
  async updateHospitalStatus(hospitalId, status) {
    // Simulate status update
    logger.info('Hospital status updated', { hospitalId, status });
  }
}

module.exports = new SQSService();
