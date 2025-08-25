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

// Enhanced error handling middleware
const handleApiError = (error, req, res, next) => {
  const timestamp = new Date().toISOString();
  const requestId = req.headers['x-request-id'] || uuidv4();
  
  logger.error('API Error:', {
    error: error.message,
    code: error.code,
    requestId,
    path: req.path,
    method: req.method,
    stack: error.stack
  });
  
  // DynamoDB specific errors
  if (error.code === 'ResourceNotFoundException') {
    return res.status(404).json({
      error: 'Resource not found',
      message: 'The requested hospital was not found',
      requestId,
      timestamp
    });
  }
  
  if (error.code === 'ValidationException') {
    return res.status(400).json({
      error: 'Validation error',
      message: error.message,
      requestId,
      timestamp
    });
  }
  
  if (error.code === 'ConditionalCheckFailedException') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Hospital already exists or condition not met',
      requestId,
      timestamp
    });
  }
  
  if (error.code === 'ProvisionedThroughputExceededException') {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests, please try again later',
      requestId,
      timestamp
    });
  }
  
  if (error.code === 'ServiceUnavailableException') {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Database service is temporarily unavailable',
      requestId,
      timestamp
    });
  }
  
  // Generic server error
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    requestId,
    timestamp
  });
};

// Async wrapper for error handling
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

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
app.get('/hospital', asyncHandler(async (req, res) => {
  const params = {
    TableName: tableName,
  };
  
  const result = await dynamoDB.scan(params).promise();
  res.status(200).json(result.Items);
}));

// Get hospital by ID
app.get('/hospital/:id', asyncHandler(async (req, res) => {
  const params = {
    TableName: tableName,
    Key: {
      id: req.params.id,
    },
  };
  
  const result = await dynamoDB.get(params).promise();
  
  if (!result.Item) {
    const error = new Error('Hospital not found');
    error.code = 'ResourceNotFoundException';
    throw error;
  }
  
  res.status(200).json(result.Item);
}));

// Create hospital
app.post('/hospital', asyncHandler(async (req, res) => {
  const { name, address, phone, email, capacity, services, operatingHours } = req.body;
  
  if (!name || !address || !phone) {
    const error = new Error('Name, address, and phone are required fields');
    error.code = 'ValidationException';
    throw error;
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
    ConditionExpression: 'attribute_not_exists(id)'
  };
  
  await dynamoDB.put(params).promise();
  res.status(201).json(hospital);
}));

// Update hospital
app.put('/hospital/:id', asyncHandler(async (req, res) => {
  const { name, address, phone, email, capacity, services, operatingHours } = req.body;
  
  // Check if hospital exists first
  const getParams = {
    TableName: tableName,
    Key: {
      id: req.params.id,
    },
  };
  
  const existingHospital = await dynamoDB.get(getParams).promise();
  
  if (!existingHospital.Item) {
    const error = new Error('Hospital not found');
    error.code = 'ResourceNotFoundException';
    throw error;
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
    ConditionExpression: 'attribute_exists(id)',
    ReturnValues: 'ALL_NEW',
  };
  
  const result = await dynamoDB.update(updateParams).promise();
  res.status(200).json(result.Attributes);
}));

// Delete hospital
app.delete('/hospital/:id', asyncHandler(async (req, res) => {
  const params = {
    TableName: tableName,
    Key: {
      id: req.params.id,
    },
    ConditionExpression: 'attribute_exists(id)',
    ReturnValues: 'ALL_OLD',
  };
  
  const result = await dynamoDB.delete(params).promise();
  res.status(200).json({ message: 'Hospital deleted successfully' });
}));

// Apply error handling middleware
app.use(handleApiError);

// Start server
app.listen(port, () => {
  logger.info(`Hospital service listening on port ${port}`);
});

module.exports = app; // For testing
