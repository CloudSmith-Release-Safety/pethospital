const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const { AuthMiddleware, authRateLimit, apiRateLimit } = require('./auth-middleware');

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

// Authentication endpoints
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password, mfaCode } = req.body;
    
    // Enhanced validation
    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        errorType: 'VALIDATION_ERROR',
        message: 'Username and password are required'
      });
    }

    // Password complexity validation
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Weak password',
        errorType: 'PASSWORD_POLICY_ERROR',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Simulate user authentication
    const user = await authenticateUser(username, password);
    
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        errorType: 'AUTHENTICATION_FAILED',
        message: 'Username or password is incorrect'
      });
    }

    // MFA validation if enabled
    if (user.mfaEnabled && !mfaCode) {
      return res.status(401).json({
        error: 'MFA required',
        errorType: 'MFA_REQUIRED',
        message: 'Multi-factor authentication code is required'
      });
    }

    if (user.mfaEnabled && !validateMFA(user.id, mfaCode)) {
      return res.status(401).json({
        error: 'Invalid MFA code',
        errorType: 'MFA_VALIDATION_FAILED',
        message: 'Multi-factor authentication code is invalid'
      });
    }

    // Generate session
    const sessionId = uuidv4();
    user.sessionId = sessionId;

    // Generate token
    const token = AuthMiddleware.generateToken(user);

    res.status(200).json({
      token: token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        hospitalId: user.hospitalId
      },
      expiresIn: '24h'
    });

  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      errorType: 'INTERNAL_ERROR'
    });
  }
});

// Helper functions
async function authenticateUser(username, password) {
  const users = {
    'admin': { 
      id: 'admin-1', 
      username: 'admin', 
      role: 'admin', 
      hospitalId: null, 
      permissions: ['read', 'write', 'delete'],
      mfaEnabled: true
    },
    'hospital_owner': { 
      id: 'owner-1', 
      username: 'hospital_owner', 
      role: 'hospital_owner', 
      hospitalId: 'hospital-123',
      permissions: ['read', 'write'],
      mfaEnabled: false
    }
  };
  return users[username] || null;
}

function validateMFA(userId, mfaCode) {
  return mfaCode === '123456';
}

// Get all hospitals - requires authentication
app.get('/hospitals', 
  AuthMiddleware.verifyToken,
  AuthMiddleware.requireRole(['admin', 'hospital_owner', 'viewer']),
  async (req, res) => {
  try {
    const params = {
      TableName: tableName,
    };
    
    const result = await dynamoDB.scan(params).promise();
    
    // Filter results based on user role
    let hospitals = result.Items;
    if (req.user.role === 'hospital_owner') {
      hospitals = hospitals.filter(h => h.id === req.user.hospitalId);
    }
    
    res.status(200).json(hospitals);
  } catch (error) {
    logger.error('Error fetching hospitals:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
});

// Get hospital by ID - requires authentication and ownership validation
app.get('/hospitals/:id', 
  AuthMiddleware.verifyToken,
  AuthMiddleware.requireRole(['admin', 'hospital_owner', 'viewer']),
  AuthMiddleware.requireHospitalOwnership,
  async (req, res) => {
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

// Create hospital - requires admin or hospital_owner role
app.post('/hospitals',
  AuthMiddleware.verifyToken,
  AuthMiddleware.requireRole(['admin', 'hospital_owner']),
  async (req, res) => {
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
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const params = {
      TableName: tableName,
      Item: hospital,
    };
    
    await dynamoDB.put(params).promise();
    
    logger.info('Hospital created', {
      hospitalId: hospital.id,
      createdBy: req.user.id,
      userRole: req.user.role
    });
    
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
