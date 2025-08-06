const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'auth-service' },
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
const tableName = process.env.DYNAMODB_TABLE || 'pet-hospital-users';

// Token configuration
const tokenConfig = {
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  tokenSecret: process.env.TOKEN_SECRET || 'pet-hospital-secret-key',
  issuer: 'pet-hospital-api',
  audience: 'pet-hospital-clients'
};

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Register new user
app.post('/auth/register', async (req, res) => {
  try {
    const { username, password, email, role } = req.body;
    
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if username already exists
    const checkParams = {
      TableName: tableName,
      FilterExpression: 'username = :username',
      ExpressionAttributeValues: {
        ':username': username,
      },
    };
    
    const existingUsers = await dynamoDB.scan(checkParams).promise();
    
    if (existingUsers.Items && existingUsers.Items.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const user = {
      id: uuidv4(),
      username,
      password: hashedPassword,
      email,
      role: role || 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const params = {
      TableName: tableName,
      Item: user,
    };
    
    await dynamoDB.put(params).promise();
    
    // Don't return the password
    const { password: _, ...userWithoutPassword } = user;
    
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    logger.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user
    const params = {
      TableName: tableName,
      FilterExpression: 'username = :username',
      ExpressionAttributeValues: {
        ':username': username,
      },
    };
    
    const result = await dynamoDB.scan(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.Items[0];
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate tokens
    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        role: user.role,
        tokenType: 'access'
      }, 
      tokenConfig.tokenSecret, 
      { 
        expiresIn: tokenConfig.accessTokenExpiry,
        issuer: tokenConfig.issuer,
        audience: tokenConfig.audience
      }
    );
    
    const refreshToken = jwt.sign(
      { 
        userId: user.id, 
        tokenType: 'refresh'
      }, 
      tokenConfig.tokenSecret, 
      { 
        expiresIn: tokenConfig.refreshTokenExpiry,
        issuer: tokenConfig.issuer,
        audience: tokenConfig.audience
      }
    );
    
    // Log successful login
    logger.info(`User ${user.username} logged in successfully`);
    
    // Return tokens and user info
    const { password: _, ...userWithoutPassword } = user;
    
    res.status(200).json({
      user: userWithoutPassword,
      accessToken,
      refreshToken,
      expiresIn: tokenConfig.accessTokenExpiry
    });
  } catch (error) {
    logger.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
app.post('/auth/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    // Verify refresh token
    try {
      const decoded = jwt.verify(refreshToken, tokenConfig.tokenSecret, {
        issuer: tokenConfig.issuer,
        audience: tokenConfig.audience
      });
      
      // Check if it's a refresh token
      if (decoded.tokenType !== 'refresh') {
        return res.status(401).json({ error: 'Invalid token type' });
      }
      
      // Get user from database to ensure they still exist and have proper permissions
      const params = {
        TableName: tableName,
        Key: {
          id: decoded.userId,
        },
      };
      
      const result = await dynamoDB.get(params).promise();
      
      if (!result.Item) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      const user = result.Item;
      
      // Generate new access token
      const accessToken = jwt.sign(
        { 
          userId: user.id, 
          role: user.role,
          tokenType: 'access'
        }, 
        tokenConfig.tokenSecret, 
        { 
          expiresIn: tokenConfig.accessTokenExpiry,
          issuer: tokenConfig.issuer,
          audience: tokenConfig.audience
        }
      );
      
      // Log token refresh
      logger.info(`Access token refreshed for user ${user.id}`);
      
      res.status(200).json({
        accessToken,
        expiresIn: tokenConfig.accessTokenExpiry
      });
    } catch (error) {
      logger.error('Token verification failed:', error.message);
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  } catch (error) {
    logger.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Validate token (for internal service use)
app.post('/auth/validate-token', (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    try {
      const decoded = jwt.verify(token, tokenConfig.tokenSecret, {
        issuer: tokenConfig.issuer,
        audience: tokenConfig.audience
      });
      
      // Check token type
      if (decoded.tokenType !== 'access') {
        return res.status(401).json({ error: 'Invalid token type' });
      }
      
      // Calculate token age and expiry
      const tokenAge = Math.floor((Date.now() / 1000) - decoded.iat);
      const tokenExpiresIn = decoded.exp - Math.floor(Date.now() / 1000);
      
      res.status(200).json({
        valid: true,
        userId: decoded.userId,
        role: decoded.role,
        tokenAge,
        tokenExpiresIn,
        issuedAt: new Date(decoded.iat * 1000).toISOString(),
        expiresAt: new Date(decoded.exp * 1000).toISOString()
      });
    } catch (error) {
      logger.error('Token validation failed:', error.message);
      return res.status(401).json({ 
        valid: false, 
        error: error.message 
      });
    }
  } catch (error) {
    logger.error('Error validating token:', error);
    res.status(500).json({ error: 'Failed to validate token' });
  }
});

// Logout (for tracking purposes)
app.post('/auth/logout', (req, res) => {
  // In a stateless JWT system, the client simply discards the tokens
  // This endpoint is for logging and future extensions
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.userId) {
        logger.info(`User ${decoded.userId} logged out`);
      }
    } catch (error) {
      // Just log the error but don't fail the request
      logger.error('Error decoding token during logout:', error);
    }
  }
  
  res.status(200).json({ message: 'Logout successful' });
});

// Security audit endpoint
app.get('/auth/audit', async (req, res) => {
  try {
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
      
      // Only allow admins to access audit logs
      if (decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      // In a real system, this would fetch audit logs from a database or log service
      // For this example, we'll return a mock response
      res.status(200).json({
        auditEvents: [
          {
            timestamp: new Date().toISOString(),
            eventType: 'user_login',
            userId: 'user123',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            success: true
          },
          {
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            eventType: 'token_refresh',
            userId: 'user456',
            ipAddress: '192.168.1.2',
            userAgent: 'Mozilla/5.0',
            success: true
          },
          {
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            eventType: 'user_login',
            userId: 'user789',
            ipAddress: '192.168.1.3',
            userAgent: 'Mozilla/5.0',
            success: false,
            reason: 'Invalid credentials'
          }
        ]
      });
    } catch (error) {
      logger.error('Token verification failed:', error.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Start server
app.listen(port, () => {
  logger.info(`Auth service listening on port ${port}`);
});

module.exports = app; // For testing