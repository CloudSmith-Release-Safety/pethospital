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
  defaultMeta: { service: 'doctor-service' },
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
const tableName = process.env.DYNAMODB_TABLE || 'pet-hospital-doctors';

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'unhealthy' });
});

// Get all doctors
app.get('/doctors', async (req, res) => {
  try {
    const params = {
      TableName: tableName,
    };
    
    const result = await dynamoDB.scan(params).promise();
    
    res.status(200).json(result.Items);
  } catch (error) {
    logger.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// Get doctor by ID
app.get('/doctors/:id', async (req, res) => {
  try {
    const params = {
      TableName: tableName,
      Key: {
        id: req.params.id,
      },
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (!result.Item) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    
    res.status(200).json(result.Item);
  } catch (error) {
    logger.error(`Error fetching doctor ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch doctor' });
  }
});

// Create doctor
app.post('/doctors', async (req, res) => {
  try {
    const { firstName, lastName, specialization, hospitalId, email, phone, licenseNumber } = req.body;
    
    if (!firstName || !lastName || !specialization || !hospitalId || !licenseNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const doctor = {
      id: uuidv4(),
      firstName,
      lastName,
      specialization,
      hospitalId,
      email: email || null,
      phone: phone || null,
      licenseNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const params = {
      TableName: tableName,
      Item: doctor,
    };
    
    await dynamoDB.put(params).promise();
    
    res.status(201).json(doctor);
  } catch (error) {
    logger.error('Error creating doctor:', error);
    res.status(500).json({ error: 'Failed to create doctor' });
  }
});

// Update doctor
app.put('/doctors/:id', async (req, res) => {
  try {
    const { firstName, lastName, specialization, hospitalId, email, phone, licenseNumber } = req.body;
    
    // Check if doctor exists
    const getParams = {
      TableName: tableName,
      Key: {
        id: req.params.id,
      },
    };
    
    const existingDoctor = await dynamoDB.get(getParams).promise();
    
    if (!existingDoctor.Item) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    
    // Update doctor
    const updateParams = {
      TableName: tableName,
      Key: {
        id: req.params.id,
      },
      UpdateExpression: 'set firstName = :firstName, lastName = :lastName, specialization = :specialization, hospitalId = :hospitalId, email = :email, phone = :phone, licenseNumber = :licenseNumber, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':firstName': firstName || existingDoctor.Item.firstName,
        ':lastName': lastName || existingDoctor.Item.lastName,
        ':specialization': specialization || existingDoctor.Item.specialization,
        ':hospitalId': hospitalId || existingDoctor.Item.hospitalId,
        ':email': email || existingDoctor.Item.email,
        ':phone': phone || existingDoctor.Item.phone,
        ':licenseNumber': licenseNumber || existingDoctor.Item.licenseNumber,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    };
    
    const result = await dynamoDB.update(updateParams).promise();
    
    res.status(200).json(result.Attributes);
  } catch (error) {
    logger.error(`Error updating doctor ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update doctor' });
  }
});

// Delete doctor
app.delete('/doctors/:id', async (req, res) => {
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
      return res.status(404).json({ error: 'Doctor not found' });
    }
    
    res.status(200).json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting doctor ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete doctor' });
  }
});

// Get doctors by hospital
app.get('/hospitals/:hospitalId/doctors', async (req, res) => {
  try {
    const params = {
      TableName: tableName,
      FilterExpression: 'hospitalId = :hospitalId',
      ExpressionAttributeValues: {
        ':hospitalId': req.params.hospitalId,
      },
    };
    
    const result = await dynamoDB.scan(params).promise();
    
    res.status(200).json(result.Items);
  } catch (error) {
    logger.error(`Error fetching doctors for hospital ${req.params.hospitalId}:`, error);
    res.status(500).json({ error: 'Failed to fetch doctors for hospital' });
  }
});

// Start server
app.listen(port, () => {
  logger.info(`Doctor service listening on port ${port}`);
});

module.exports = app; // For testing
