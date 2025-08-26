const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

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
    
    // Enhanced error handling with new error types
    if (error.code === 'NetworkingError') {
      return res.status(503).json({ 
        error: 'Service temporarily unavailable',
        errorType: 'NETWORK_ERROR',
        message: 'Unable to connect to database service',
        retryAfter: 30
      });
    }
    
    if (error.code === 'ThrottlingException') {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        errorType: 'THROTTLING_ERROR',
        message: 'Too many requests, please slow down',
        retryAfter: 60
      });
    }
    
    if (error.code === 'AccessDeniedException') {
      return res.status(403).json({ 
        error: 'Access denied',
        errorType: 'AUTHORIZATION_ERROR',
        message: 'Insufficient permissions to access hospitals data'
      });
    }
    
    if (error.code === 'ItemCollectionSizeLimitExceededException') {
      return res.status(413).json({ 
        error: 'Payload too large',
        errorType: 'SIZE_LIMIT_ERROR',
        message: 'Hospital collection size exceeds limits'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch hospitals',
      errorType: 'INTERNAL_ERROR'
    });
  }
});

// Get hospital by ID
app.get('/hospitals/:id', async (req, res) => {
  try {
    // Input validation for hospital ID
    if (!req.params.id || req.params.id.length < 3) {
      return res.status(400).json({ 
        error: 'Invalid hospital ID format',
        errorType: 'VALIDATION_ERROR',
        message: 'Hospital ID must be at least 3 characters long'
      });
    }
    
    const params = {
      TableName: tableName,
      Key: {
        id: req.params.id,
      },
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (!result.Item) {
      return res.status(404).json({ 
        error: 'Hospital not found',
        errorType: 'NOT_FOUND_ERROR',
        message: `Hospital with ID ${req.params.id} does not exist`
      });
    }
    
    res.status(200).json(result.Item);
  } catch (error) {
    logger.error(`Error fetching hospital ${req.params.id}:`, error);
    
    // Enhanced error handling with new error types
    if (error.code === 'RequestTimeoutException') {
      return res.status(408).json({ 
        error: 'Request timeout',
        errorType: 'TIMEOUT_ERROR',
        message: 'Database request timed out, please try again'
      });
    }
    
    if (error.code === 'InternalServerError') {
      return res.status(502).json({ 
        error: 'Bad gateway',
        errorType: 'GATEWAY_ERROR',
        message: 'Database service returned an invalid response'
      });
    }
    
    if (error.code === 'UnrecognizedClientException') {
      return res.status(401).json({ 
        error: 'Authentication failed',
        errorType: 'AUTHENTICATION_ERROR',
        message: 'Invalid or expired credentials'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch hospital',
      errorType: 'INTERNAL_ERROR'
    });
  }
});

// Create hospital
app.post('/hospitals', async (req, res) => {
  try {
    const { name, address, phone, email, capacity, services, operatingHours } = req.body;
    
    // Enhanced validation with specific error types
    if (!name || !address || !phone) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        errorType: 'VALIDATION_ERROR',
        message: 'Name, address, and phone are required',
        missingFields: [
          !name && 'name',
          !address && 'address', 
          !phone && 'phone'
        ].filter(Boolean)
      });
    }
    
    // Validate phone format
    if (!/^\+?[\d\s\-\(\)]{10,}$/.test(phone)) {
      return res.status(400).json({ 
        error: 'Invalid phone format',
        errorType: 'FORMAT_ERROR',
        message: 'Phone number must be at least 10 digits'
      });
    }
    
    // Validate capacity
    if (capacity && (capacity < 0 || capacity > 10000)) {
      return res.status(400).json({ 
        error: 'Invalid capacity value',
        errorType: 'RANGE_ERROR',
        message: 'Capacity must be between 0 and 10000'
      });
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const params = {
      TableName: tableName,
      Item: hospital,
    };
    
    await dynamoDB.put(params).promise();
    
    res.status(201).json(hospital);
  } catch (error) {
    logger.error('Error creating hospital:', error);
    
    // Enhanced error handling with new error types
    if (error.code === 'ConditionalCheckFailedException') {
      return res.status(409).json({ 
        error: 'Hospital already exists',
        errorType: 'DUPLICATE_ERROR',
        message: 'A hospital with this information already exists'
      });
    }
    
    if (error.code === 'ProvisionedThroughputExceededException') {
      return res.status(503).json({ 
        error: 'Service overloaded',
        errorType: 'CAPACITY_ERROR',
        message: 'Database is currently overloaded, please try again later',
        retryAfter: 120
      });
    }
    
    if (error.code === 'ItemSizeTooLargeException') {
      return res.status(413).json({ 
        error: 'Hospital data too large',
        errorType: 'SIZE_ERROR',
        message: 'Hospital information exceeds maximum allowed size'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create hospital',
      errorType: 'INTERNAL_ERROR'
    });
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

// Start server
app.listen(port, () => {
  logger.info(`Hospital service listening on port ${port}`);
});

module.exports = app; // For testing
