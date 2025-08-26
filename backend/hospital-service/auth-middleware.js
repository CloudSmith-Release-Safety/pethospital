const jwt = require('jsonwebtoken');
const winston = require('winston');
const rateLimit = require('express-rate-limit');

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

const JWT_SECRET = process.env.JWT_SECRET || 'hospital-service-secret-key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Rate limiting configuration
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs: windowMs,
    max: max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.user?.id || req.ip;
    }
  });
};

// Rate limits
const authRateLimit = createRateLimit(15 * 60 * 1000, 5, 'Too many authentication attempts');
const apiRateLimit = createRateLimit(15 * 60 * 1000, 100, 'Too many API requests');

class AuthMiddleware {
  
  /**
   * Verify JWT token with enhanced validation
   */
  static verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return res.status(401).json({
          error: 'Access denied',
          errorType: 'MISSING_TOKEN',
          message: 'Authorization header is required'
        });
      }

      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

      if (!token) {
        return res.status(401).json({
          error: 'Access denied',
          errorType: 'INVALID_TOKEN_FORMAT',
          message: 'Token must be provided in Bearer format'
        });
      }

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Enhanced validation checks
      if (!decoded.userId || !decoded.role) {
        return res.status(401).json({
          error: 'Invalid token',
          errorType: 'MALFORMED_TOKEN',
          message: 'Token missing required claims'
        });
      }

      // Check token expiry with buffer
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        return res.status(401).json({
          error: 'Token expired',
          errorType: 'EXPIRED_TOKEN',
          message: 'Please refresh your authentication token'
        });
      }

      // Additional security checks
      if (decoded.iss !== 'hospital-service') {
        return res.status(401).json({
          error: 'Invalid token issuer',
          errorType: 'INVALID_ISSUER',
          message: 'Token not issued by authorized service'
        });
      }

      // Attach user info to request
      req.user = {
        id: decoded.userId,
        role: decoded.role,
        hospitalId: decoded.hospitalId,
        permissions: decoded.permissions || [],
        sessionId: decoded.sessionId
      };

      logger.info('Token verified successfully', {
        userId: req.user.id,
        role: req.user.role,
        endpoint: req.path
      });

      next();
    } catch (error) {
      logger.error('Token verification failed', {
        error: error.message,
        endpoint: req.path,
        ip: req.ip
      });

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Invalid token',
          errorType: 'MALFORMED_TOKEN',
          message: 'Token signature verification failed'
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          errorType: 'EXPIRED_TOKEN',
          message: 'Authentication token has expired'
        });
      }

      return res.status(401).json({
        error: 'Authentication failed',
        errorType: 'AUTH_ERROR',
        message: 'Unable to verify authentication token'
      });
    }
  }

  /**
   * Role-based authorization
   */
  static requireRole(allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          errorType: 'NO_USER_CONTEXT'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn('Insufficient permissions', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: allowedRoles,
          endpoint: req.path
        });

        return res.status(403).json({
          error: 'Insufficient permissions',
          errorType: 'ROLE_PERMISSION_DENIED',
          message: `Required role: ${allowedRoles.join(' or ')}`,
          userRole: req.user.role
        });
      }

      next();
    };
  }

  /**
   * Hospital ownership validation
   */
  static requireHospitalOwnership(req, res, next) {
    const hospitalId = req.params.id || req.body.hospitalId;
    
    if (!hospitalId) {
      return res.status(400).json({
        error: 'Hospital ID required',
        errorType: 'MISSING_HOSPITAL_ID'
      });
    }

    // Admin can access any hospital
    if (req.user.role === 'admin') {
      return next();
    }

    // Hospital owner can only access their own hospital
    if (req.user.role === 'hospital_owner' && req.user.hospitalId === hospitalId) {
      return next();
    }

    logger.warn('Hospital ownership validation failed', {
      userId: req.user.id,
      userHospitalId: req.user.hospitalId,
      requestedHospitalId: hospitalId,
      endpoint: req.path
    });

    return res.status(403).json({
      error: 'Access denied',
      errorType: 'HOSPITAL_OWNERSHIP_DENIED',
      message: 'You can only access your own hospital data'
    });
  }

  /**
   * Enhanced session validation
   */
  static validateSession(req, res, next) {
    if (!req.user.sessionId) {
      return res.status(401).json({
        error: 'Invalid session',
        errorType: 'MISSING_SESSION_ID'
      });
    }

    // Additional session checks could be added here
    // e.g., check against active sessions in Redis/database
    
    next();
  }

  /**
   * IP whitelist validation
   */
  static validateIPWhitelist(allowedIPs = []) {
    return (req, res, next) => {
      if (allowedIPs.length === 0) {
        return next(); // No IP restrictions
      }

      const clientIP = req.ip || req.connection.remoteAddress;
      
      if (!allowedIPs.includes(clientIP)) {
        logger.warn('IP access denied', {
          clientIP: clientIP,
          allowedIPs: allowedIPs,
          userId: req.user?.id
        });

        return res.status(403).json({
          error: 'Access denied',
          errorType: 'IP_NOT_WHITELISTED',
          message: 'Your IP address is not authorized'
        });
      }

      next();
    };
  }

  /**
   * Generate JWT token
   */
  static generateToken(user) {
    const payload = {
      userId: user.id,
      role: user.role,
      hospitalId: user.hospitalId,
      permissions: user.permissions || [],
      sessionId: user.sessionId,
      iss: 'hospital-service',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  }
}

module.exports = {
  AuthMiddleware,
  authRateLimit,
  apiRateLimit
};
