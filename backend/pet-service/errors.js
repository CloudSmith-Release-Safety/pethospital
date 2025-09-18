const { v4: uuidv4 } = require('uuid');

const ERROR_CODES = {
  PET_NOT_FOUND: 'PET_NOT_FOUND',
  MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',
  DATABASE_ERROR: 'DATABASE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
};

const createErrorResponse = (code, message, details = null) => ({
  error: {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
    requestId: uuidv4()
  }
});

module.exports = { ERROR_CODES, createErrorResponse };
