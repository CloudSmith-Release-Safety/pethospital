const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const cacheService = require('./cache-service');

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

// Get all hospitals with caching
app.get('/hospitals', async (req, res) => {
  try {
    const { location, services, capacity } = req.query;
    const filters = JSON.stringify({ location, services, capacity });
    const cacheKey = cacheService.constructor.keys.hospitalList(filters);
    
    // Try to get from cache first
    const cachedHospitals = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info('Fetching hospitals from database', { filters });
        
        const params = {
          TableName: tableName,
        };
        
        const result = await dynamoDB.scan(params).promise();
        let hospitals = result.Items;
        
        // Apply filters if provided
        if (services) {
          const serviceList = services.split(',');
          hospitals = hospitals.filter(h => 
            serviceList.some(service => h.services?.includes(service))
          );
        }
        
        if (capacity) {
          const minCapacity = parseInt(capacity);
          hospitals = hospitals.filter(h => h.capacity >= minCapacity);
        }
        
        return hospitals;
      },
      cacheService.constructor.TTL.HOSPITAL_LIST
    );
    
    logger.info('Hospitals retrieved', { 
      count: cachedHospitals.length, 
      cached: true,
      filters 
    });
    
    res.status(200).json(cachedHospitals);
  } catch (error) {
    logger.error('Error fetching hospitals:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
});

// Get hospital by ID with caching
app.get('/hospitals/:id', async (req, res) => {
  try {
    const hospitalId = req.params.id;
    const cacheKey = cacheService.constructor.keys.hospital(hospitalId);
    
    // Try to get from cache first
    const hospital = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info('Fetching hospital from database', { hospitalId });
        
        const params = {
          TableName: tableName,
          Key: {
            id: hospitalId,
          },
        };
        
        const result = await dynamoDB.get(params).promise();
        return result.Item || null;
      },
      cacheService.constructor.TTL.HOSPITAL_DETAILS
    );
    
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    logger.info('Hospital retrieved', { 
      hospitalId, 
      cached: true 
    });
    
    res.status(200).json(hospital);
  } catch (error) {
    logger.error(`Error fetching hospital ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch hospital' });
  }
});

// Create hospital with cache invalidation
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
    
    // Cache the new hospital
    const hospitalCacheKey = cacheService.constructor.keys.hospital(hospital.id);
    await cacheService.set(
      hospitalCacheKey, 
      hospital, 
      cacheService.constructor.TTL.HOSPITAL_DETAILS
    );
    
    // Invalidate hospital list caches
    await cacheService.deletePattern('hospitals:list:*');
    await cacheService.deletePattern('search:*');
    
    logger.info('Hospital created and cached', { 
      hospitalId: hospital.id,
      cacheInvalidated: true 
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

// Delete hospital with cache invalidation
app.delete('/hospitals/:id', async (req, res) => {
  try {
    const hospitalId = req.params.id;
    
    const params = {
      TableName: tableName,
      Key: {
        id: hospitalId,
      },
      ReturnValues: 'ALL_OLD',
    };
    
    const result = await dynamoDB.delete(params).promise();
    
    if (!result.Attributes) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    // Invalidate caches
    await cacheService.delete(cacheService.constructor.keys.hospital(hospitalId));
    await cacheService.deletePattern('hospitals:list:*');
    await cacheService.deletePattern('search:*');
    
    logger.info('Hospital deleted and cache invalidated', { hospitalId });
    
    res.status(200).json({ message: 'Hospital deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting hospital ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete hospital' });
  }
});

// Search hospitals with caching
app.get('/hospitals/search/:query', async (req, res) => {
  try {
    const query = req.params.query.toLowerCase();
    const cacheKey = cacheService.constructor.keys.searchResults(query);
    
    const searchResults = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info('Performing hospital search', { query });
        
        const params = {
          TableName: tableName,
        };
        
        const result = await dynamoDB.scan(params).promise();
        
        // Filter hospitals by search query
        const filteredHospitals = result.Items.filter(hospital => 
          hospital.name.toLowerCase().includes(query) ||
          hospital.address.toLowerCase().includes(query) ||
          (hospital.services && hospital.services.some(service => 
            service.toLowerCase().includes(query)
          ))
        );
        
        return filteredHospitals;
      },
      cacheService.constructor.TTL.SEARCH_RESULTS
    );
    
    logger.info('Search completed', { 
      query, 
      resultCount: searchResults.length,
      cached: true 
    });
    
    res.status(200).json(searchResults);
  } catch (error) {
    logger.error('Error searching hospitals:', error);
    res.status(500).json({ error: 'Failed to search hospitals' });
  }
});

// Cache management endpoints
app.get('/admin/cache/stats', async (req, res) => {
  try {
    const stats = await cacheService.getStats();
    res.status(200).json(stats);
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Failed to get cache statistics' });
  }
});

app.delete('/admin/cache/clear', async (req, res) => {
  try {
    const { pattern } = req.query;
    
    if (pattern) {
      await cacheService.deletePattern(pattern);
      logger.info('Cache pattern cleared', { pattern });
      res.status(200).json({ message: `Cache pattern '${pattern}' cleared` });
    } else {
      // Clear all hospital-related caches
      await cacheService.deletePattern('hospital:*');
      await cacheService.deletePattern('hospitals:*');
      await cacheService.deletePattern('search:*');
      logger.info('All hospital caches cleared');
      res.status(200).json({ message: 'All hospital caches cleared' });
    }
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Start server
app.listen(port, () => {
  logger.info(`Hospital service listening on port ${port}`);
});

module.exports = app; // For testing
