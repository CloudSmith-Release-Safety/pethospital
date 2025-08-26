const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const sqsService = require('./sqs-service');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'hospital-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// Configure AWS
const dynamoDB = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-west-2',
});
const tableName = process.env.DYNAMODB_TABLE || 'pet-hospital-hospitals';

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Get all hospitals
app.get('/hospitals', async (req, res) => {
  try {
    const params = {
      TableName: tableName,
    };
    
    const result = await dynamoDB.scan(params).promise();
    
    res.status(200).json(result.Items);
  } catch (error) {
    logger.error('Error fetching hospitals:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
});

// Get hospital by ID
app.get('/hospitals/:id', async (req, res) => {
  try {
    const params = {
      TableName: tableName,
      Key: {
        id: req.params.id,
      },
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (!result.Item) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    res.status(200).json(result.Item);
  } catch (error) {
    logger.error(`Error fetching hospital ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch hospital' });
  }
});

// Create hospital
app.post('/hospitals', async (req, res) => {
  try {
    const { name, address, phone, email, capacity, services, operatingHours } = req.body;
    
    if (!name || !address || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const hospital = {
      id: uuidv4(),
      name,
      address,
      phone,
      email: email || null,
      capacity: capacity || null,
      services: services || [],
      operatingHours: operatingHours || {},
      status: 'pending_validation', // New status for async processing
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Save hospital to database first
    const params = {
      TableName: tableName,
      Item: hospital,
    };
    
    await dynamoDB.put(params).promise();
    
    // Queue hospital for async processing
    try {
      const messageId = await sqsService.queueHospitalProcessing(hospital, 'create');
      
      // Queue notification for hospital creation
      await sqsService.queueNotification(hospital.id, 'created', ['admin@hospital.com']);
      
      logger.info('Hospital created and queued for processing', {
        hospitalId: hospital.id,
        messageId: messageId
      });
      
      res.status(202).json({
        ...hospital,
        message: 'Hospital created and queued for validation',
        processingStatus: 'queued'
      });
      
    } catch (sqsError) {
      logger.error('Failed to queue hospital processing', {
        hospitalId: hospital.id,
        error: sqsError.message
      });
      
      // Hospital was saved but queuing failed - still return success
      res.status(201).json({
        ...hospital,
        message: 'Hospital created but async processing failed',
        processingStatus: 'failed_to_queue'
      });
    }
    
  } catch (error) {
    logger.error('Error creating hospital:', error);
    res.status(500).json({ error: 'Failed to create hospital' });
  }
});

// Update hospital
app.put('/hospitals/:id', async (req, res) => {
  try {
    const { name, address, phone, email, capacity, services, operatingHours } = req.body;
    
    // Check if hospital exists
    const getParams = {
      TableName: tableName,
      Key: {
        id: req.params.id,
      },
    };
    
    const existingHospital = await dynamoDB.get(getParams).promise();
    
    if (!existingHospital.Item) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    // Update hospital
    const updateParams = {
      TableName: tableName,
      Key: {
        id: req.params.id,
      },
      UpdateExpression: 'set #name = :name, address = :address, phone = :phone, email = :email, capacity = :capacity, services = :services, operatingHours = :operatingHours, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#name': 'name', // 'name' is a reserved keyword in DynamoDB
      },
      ExpressionAttributeValues: {
        ':name': name || existingHospital.Item.name,
        ':address': address || existingHospital.Item.address,
        ':phone': phone || existingHospital.Item.phone,
        ':email': email || existingHospital.Item.email,
        ':capacity': capacity || existingHospital.Item.capacity,
        ':services': services || existingHospital.Item.services,
        ':operatingHours': operatingHours || existingHospital.Item.operatingHours,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    };
    
    const result = await dynamoDB.update(updateParams).promise();
    
    res.status(200).json(result.Attributes);
  } catch (error) {
    logger.error(`Error updating hospital ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update hospital' });
  }
});

// Delete hospital
app.delete('/hospitals/:id', async (req, res) => {
  try {
    const params = {
      TableName: tableName,
      Key: {
        id: req.params.id,
      },
      ReturnValues: 'ALL_OLD',
    };
    
    const result = await dynamoDB.delete(params).promise();
    
    if (!result.Attributes) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    res.status(200).json({ message: 'Hospital deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting hospital ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete hospital' });
  }
});

// Async processing endpoints
app.post('/hospitals/bulk-process', async (req, res) => {
  try {
    const { hospitalIds, operation } = req.body;
    
    if (!hospitalIds || !Array.isArray(hospitalIds) || hospitalIds.length === 0) {
      return res.status(400).json({ error: 'Hospital IDs array is required' });
    }
    
    if (!['validate', 'update_status', 'notify'].includes(operation)) {
      return res.status(400).json({ error: 'Invalid operation' });
    }
    
    const queuedMessages = [];
    
    for (const hospitalId of hospitalIds) {
      try {
        // Get hospital data
        const getParams = {
          TableName: tableName,
          Key: { id: hospitalId }
        };
        
        const hospitalResult = await dynamoDB.get(getParams).promise();
        
        if (hospitalResult.Item) {
          const messageId = await sqsService.queueHospitalProcessing(
            hospitalResult.Item, 
            operation
          );
          queuedMessages.push({ hospitalId, messageId });
        }
      } catch (error) {
        logger.error(`Failed to queue hospital ${hospitalId}`, { error: error.message });
      }
    }
    
    res.status(202).json({
      message: 'Bulk processing queued',
      queuedCount: queuedMessages.length,
      totalRequested: hospitalIds.length,
      queuedMessages: queuedMessages
    });
    
  } catch (error) {
    logger.error('Error in bulk processing:', error);
    res.status(500).json({ error: 'Failed to queue bulk processing' });
  }
});

// Process queue manually (for testing/admin)
app.post('/admin/process-queue', async (req, res) => {
  try {
    const processedCount = await sqsService.processHospitalQueue();
    
    res.status(200).json({
      message: 'Queue processing completed',
      processedMessages: processedCount
    });
    
  } catch (error) {
    logger.error('Error processing queue:', error);
    res.status(500).json({ error: 'Failed to process queue' });
  }
});

// Start server
app.listen(port, () => {
  logger.info(`Hospital service listening on port ${port}`);
});

module.exports = app; // For testing
