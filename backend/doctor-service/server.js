const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const jwt = require('jsonwebtoken');

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

// Token configuration
const tokenConfig = {
  tokenSecret: process.env.TOKEN_SECRET || 'pet-hospital-secret-key',
  issuer: 'pet-hospital-api',
  audience: 'pet-hospital-clients'
};

// Authentication middleware
const authenticate = (req, res, next) => {
  // Skip authentication for health endpoint
  if (req.path === '/health') {
    return next();
  }
  
  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, tokenConfig.tokenSecret, {
      issuer: tokenConfig.issuer,
      audience: tokenConfig.audience
    });
    
    // Check if it's an access token
    if (decoded.tokenType !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    
    // Add user info to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };
    
    // Session monitoring
    const tokenAge = Math.floor((Date.now() / 1000) - decoded.iat);
    const tokenExpiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    
    // Add session info to response headers for monitoring
    res.set('X-Session-Created', new Date(decoded.iat * 1000).toISOString());
    res.set('X-Session-Expires', new Date(decoded.exp * 1000).toISOString());
    res.set('X-Session-Age', `${tokenAge}s`);
    res.set('X-Session-Remaining', `${tokenExpiresIn}s`);
    
    next();
  } catch (error) {
    logger.error('Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Role-based authorization middleware
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

// Security audit logging middleware
const auditLog = (req, res, next) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  const start = Date.now();
  
  // Add request ID to response headers
  res.set('X-Request-ID', requestId);
  
  // Log request
  logger.info({
    type: 'security_audit',
    event: 'request_received',
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user ? req.user.userId : 'unauthenticated'
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      type: 'security_audit',
      event: 'request_completed',
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user ? req.user.userId : 'unauthenticated'
    });
  });
  
  next();
};

// Apply middleware
app.use(auditLog);
app.use(authenticate);

// Configure AWS
const dynamoDB = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-west-2',
});
const tableName = process.env.DYNAMODB_TABLE || 'pet-hospital-doctors';

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Get all doctors
app.get('/doctors', authorize(['user', 'admin', 'vet']), async (req, res) => {
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
app.get('/doctors/:id', authorize(['user', 'admin', 'vet']), async (req, res) => {
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
app.post('/doctors', authorize(['admin', 'vet']), async (req, res) => {
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
      createdBy: req.user.userId,
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
app.put('/doctors/:id', authorize(['admin', 'vet']), async (req, res) => {
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
      UpdateExpression: 'set firstName = :firstName, lastName = :lastName, specialization = :specialization, hospitalId = :hospitalId, email = :email, phone = :phone, licenseNumber = :licenseNumber, updatedBy = :updatedBy, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':firstName': firstName || existingDoctor.Item.firstName,
        ':lastName': lastName || existingDoctor.Item.lastName,
        ':specialization': specialization || existingDoctor.Item.specialization,
        ':hospitalId': hospitalId || existingDoctor.Item.hospitalId,
        ':email': email || existingDoctor.Item.email,
        ':phone': phone || existingDoctor.Item.phone,
        ':licenseNumber': licenseNumber || existingDoctor.Item.licenseNumber,
        ':updatedBy': req.user.userId,
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
app.delete('/doctors/:id', authorize(['admin']), async (req, res) => {
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
app.get('/hospitals/:hospitalId/doctors', authorize(['user', 'admin', 'vet']), async (req, res) => {
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