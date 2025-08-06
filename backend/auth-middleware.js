const jwt = require('jsonwebtoken');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'auth-middleware' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Token validation configuration
const tokenConfig = {
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m', // Short-lived access token
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d', // Longer-lived refresh token
  tokenSecret: process.env.TOKEN_SECRET || 'pet-hospital-secret-key', // Should be in environment variables
  issuer: 'pet-hospital-api',
  audience: 'pet-hospital-clients'
};

// Generate tokens
const generateTokens = (userId, role) => {
  // Access token - short lived
  const accessToken = jwt.sign(
    { 
      userId, 
      role,
      tokenType: 'access'
    }, 
    tokenConfig.tokenSecret, 
    { 
      expiresIn: tokenConfig.accessTokenExpiry,
      issuer: tokenConfig.issuer,
      audience: tokenConfig.audience
    }
  );
  
  // Refresh token - longer lived
  const refreshToken = jwt.sign(
    { 
      userId, 
      tokenType: 'refresh'
    }, 
    tokenConfig.tokenSecret, 
    { 
      expiresIn: tokenConfig.refreshTokenExpiry,
      issuer: tokenConfig.issuer,
      audience: tokenConfig.audience
    }
  );
  
  return { accessToken, refreshToken };
};

// Verify token
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, tokenConfig.tokenSecret, {
      issuer: tokenConfig.issuer,
      audience: tokenConfig.audience
    });
    return { valid: true, decoded };
  } catch (error) {
    logger.error('Token verification failed:', error.message);
    return { valid: false, error: error.message };
  }
};

// Authentication middleware
const authenticate = (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.split(' ')[1];
  const { valid, decoded, error } = verifyToken(token);
  
  if (!valid) {
    return res.status(401).json({ error: 'Invalid or expired token', details: error });
  }
  
  // Check if it's an access token
  if (decoded.tokenType !== 'access') {
    return res.status(401).json({ error: 'Invalid token type' });
  }
  
  // Add user info to request
  req.user = {
    userId: decoded.userId,
    role: decoded.role
  };
  
  // Log authentication
  logger.info(`Authenticated user ${decoded.userId} with role ${decoded.role}`);
  
  // Session monitoring
  const tokenAge = Math.floor((Date.now() / 1000) - decoded.iat);
  const tokenExpiresIn = decoded.exp - Math.floor(Date.now() / 1000);
  
  // Add session info to response headers for monitoring
  res.set('X-Session-Created', new Date(decoded.iat * 1000).toISOString());
  res.set('X-Session-Expires', new Date(decoded.exp * 1000).toISOString());
  res.set('X-Session-Age', `${tokenAge}s`);
  res.set('X-Session-Remaining', `${tokenExpiresIn}s`);
  
  next();
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

// Refresh token endpoint handler
const refreshAccessToken = (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }
  
  const { valid, decoded, error } = verifyToken(refreshToken);
  
  if (!valid) {
    return res.status(401).json({ error: 'Invalid or expired refresh token', details: error });
  }
  
  // Check if it's a refresh token
  if (decoded.tokenType !== 'refresh') {
    return res.status(401).json({ error: 'Invalid token type' });
  }
  
  // Generate new access token
  const { accessToken } = generateTokens(decoded.userId, decoded.role);
  
  res.json({ accessToken });
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

module.exports = {
  authenticate,
  authorize,
  generateTokens,
  verifyToken,
  refreshAccessToken,
  auditLog,
  tokenConfig
};