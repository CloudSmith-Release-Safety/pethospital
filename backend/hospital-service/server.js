const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const { ERROR_CODES, createErrorResponse } = require('./errors');

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

// Start server
app.listen(port, () => {
  logger.info(`Hospital service listening on port ${port}`);
});

module.exports = app; // For testing
