const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const DataTransformer = require('./data-transformer');

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

// Create hospital with data transformation pipeline
app.post('/hospitals', async (req, res) => {
  try {
    const { name, address, phone, email, capacity, services, operatingHours } = req.body;
    
    // Basic validation before transformation
    if (!name || !address || !phone) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        errorType: 'VALIDATION_ERROR',
        missingFields: [
          !name && 'name',
          !address && 'address',
          !phone && 'phone'
        ].filter(Boolean)
      });
    }
    
    // Prepare raw hospital data
    const rawHospitalData = {
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
    
    // Transform data through processing pipeline
    const transformedHospital = await DataTransformer.transformHospitalData(
      rawHospitalData, 
      'create'
    );
    
    // Check data quality threshold
    if (transformedHospital.dataQuality.overallScore < 60) {
      logger.warn('Hospital data quality below threshold', {
        hospitalId: transformedHospital.id,
        qualityScore: transformedHospital.dataQuality.overallScore
      });
      
      return res.status(422).json({
        error: 'Data quality insufficient',
        errorType: 'DATA_QUALITY_ERROR',
        qualityScore: transformedHospital.dataQuality.overallScore,
        qualityMetrics: transformedHospital.dataQuality,
        message: 'Please provide more complete and accurate hospital information'
      });
    }
    
    // Save transformed hospital to database
    const params = {
      TableName: tableName,
      Item: transformedHospital,
    };
    
    await dynamoDB.put(params).promise();
    
    logger.info('Hospital created with data transformation', {
      hospitalId: transformedHospital.id,
      qualityScore: transformedHospital.dataQuality.overallScore,
      transformationsApplied: transformedHospital.transformationMetadata.transformationsApplied,
      capacityTier: transformedHospital.capacityTier,
      serviceCategories: transformedHospital.serviceCategories
    });
    
    // Return response with transformation metadata
    res.status(201).json({
      ...transformedHospital,
      processingInfo: {
        dataQualityScore: transformedHospital.dataQuality.overallScore,
        transformationsApplied: transformedHospital.transformationMetadata.transformationsApplied,
        enrichmentData: {
          location: transformedHospital.location,
          capacityTier: transformedHospital.capacityTier,
          serviceCategories: transformedHospital.serviceCategories
        }
      }
    });
    
  } catch (error) {
    logger.error('Error creating hospital with transformation:', error);
    
    if (error.message.includes('Data transformation failed')) {
      return res.status(422).json({
        error: 'Data processing failed',
        errorType: 'TRANSFORMATION_ERROR',
        message: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create hospital',
      errorType: 'INTERNAL_ERROR'
    });
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

// Update hospital with data transformation
app.put('/hospitals/:id', async (req, res) => {
  try {
    const hospitalId = req.params.id;
    const { name, address, phone, email, capacity, services, operatingHours } = req.body;
    
    // Check if hospital exists
    const getParams = {
      TableName: tableName,
      Key: { id: hospitalId }
    };
    
    const existingHospital = await dynamoDB.get(getParams).promise();
    
    if (!existingHospital.Item) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    // Prepare updated hospital data
    const updatedHospitalData = {
      ...existingHospital.Item,
      name: name || existingHospital.Item.name,
      address: address || existingHospital.Item.address,
      phone: phone || existingHospital.Item.phone,
      email: email !== undefined ? email : existingHospital.Item.email,
      capacity: capacity !== undefined ? capacity : existingHospital.Item.capacity,
      services: services || existingHospital.Item.services,
      operatingHours: operatingHours || existingHospital.Item.operatingHours,
      updatedAt: new Date().toISOString(),
    };
    
    // Transform updated data through processing pipeline
    const transformedHospital = await DataTransformer.transformHospitalData(
      updatedHospitalData, 
      'update'
    );
    
    // Save transformed hospital
    const updateParams = {
      TableName: tableName,
      Item: transformedHospital,
    };
    
    await dynamoDB.put(updateParams).promise();
    
    logger.info('Hospital updated with data transformation', {
      hospitalId: transformedHospital.id,
      qualityScore: transformedHospital.dataQuality.overallScore,
      operation: 'update'
    });
    
    res.status(200).json({
      ...transformedHospital,
      processingInfo: {
        dataQualityScore: transformedHospital.dataQuality.overallScore,
        transformationsApplied: transformedHospital.transformationMetadata.transformationsApplied
      }
    });
    
  } catch (error) {
    logger.error(`Error updating hospital ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update hospital' });
  }
});

// Data transformation endpoints
app.post('/hospitals/:id/reprocess', async (req, res) => {
  try {
    const hospitalId = req.params.id;
    
    // Get existing hospital
    const getParams = {
      TableName: tableName,
      Key: { id: hospitalId }
    };
    
    const result = await dynamoDB.get(getParams).promise();
    
    if (!result.Item) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    // Reprocess through transformation pipeline
    const reprocessedHospital = await DataTransformer.transformHospitalData(
      result.Item, 
      'reprocess'
    );
    
    // Save reprocessed data
    const updateParams = {
      TableName: tableName,
      Item: reprocessedHospital,
    };
    
    await dynamoDB.put(updateParams).promise();
    
    logger.info('Hospital reprocessed', {
      hospitalId: reprocessedHospital.id,
      previousQualityScore: result.Item.dataQuality?.overallScore,
      newQualityScore: reprocessedHospital.dataQuality.overallScore
    });
    
    res.status(200).json({
      message: 'Hospital data reprocessed successfully',
      hospitalId: reprocessedHospital.id,
      qualityImprovement: {
        previous: result.Item.dataQuality?.overallScore || 0,
        current: reprocessedHospital.dataQuality.overallScore,
        improvement: (reprocessedHospital.dataQuality.overallScore - (result.Item.dataQuality?.overallScore || 0))
      },
      transformedData: reprocessedHospital
    });
    
  } catch (error) {
    logger.error(`Error reprocessing hospital ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to reprocess hospital data' });
  }
});

// Data quality analytics endpoint
app.get('/admin/data-quality/stats', async (req, res) => {
  try {
    const params = {
      TableName: tableName,
    };
    
    const result = await dynamoDB.scan(params).promise();
    const hospitals = result.Items;
    
    // Calculate quality statistics
    const qualityStats = hospitals.reduce((stats, hospital) => {
      const quality = hospital.dataQuality;
      
      if (quality) {
        stats.totalHospitals++;
        stats.totalQualityScore += quality.overallScore;
        stats.completenessSum += quality.completeness;
        stats.accuracySum += quality.accuracy;
        stats.consistencySum += quality.consistency;
        stats.validitySum += quality.validity;
        
        if (quality.overallScore >= 90) stats.highQuality++;
        else if (quality.overallScore >= 70) stats.mediumQuality++;
        else stats.lowQuality++;
      } else {
        stats.unprocessed++;
      }
      
      return stats;
    }, {
      totalHospitals: 0,
      unprocessed: 0,
      highQuality: 0,
      mediumQuality: 0,
      lowQuality: 0,
      totalQualityScore: 0,
      completenessSum: 0,
      accuracySum: 0,
      consistencySum: 0,
      validitySum: 0
    });
    
    const processedCount = qualityStats.totalHospitals;
    
    const analytics = {
      overview: {
        totalHospitals: hospitals.length,
        processedHospitals: processedCount,
        unprocessedHospitals: qualityStats.unprocessed,
        processingRate: processedCount > 0 ? ((processedCount / hospitals.length) * 100).toFixed(2) : 0
      },
      qualityDistribution: {
        highQuality: qualityStats.highQuality,
        mediumQuality: qualityStats.mediumQuality,
        lowQuality: qualityStats.lowQuality
      },
      averageScores: processedCount > 0 ? {
        overall: (qualityStats.totalQualityScore / processedCount).toFixed(2),
        completeness: (qualityStats.completenessSum / processedCount).toFixed(2),
        accuracy: (qualityStats.accuracySum / processedCount).toFixed(2),
        consistency: (qualityStats.consistencySum / processedCount).toFixed(2),
        validity: (qualityStats.validitySum / processedCount).toFixed(2)
      } : null
    };
    
    res.status(200).json(analytics);
    
  } catch (error) {
    logger.error('Error getting data quality stats:', error);
    res.status(500).json({ error: 'Failed to get data quality statistics' });
  }
});

// Start server
app.listen(port, () => {
  logger.info(`Hospital service listening on port ${port}`);
});

module.exports = app; // For testing
