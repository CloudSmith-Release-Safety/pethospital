const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const { initialize, isEnabled, getVariant, getFeatureToggleDefinitions } = require('unleash-client');

// Initialize feature flags
const unleash = initialize({
  url: process.env.UNLEASH_API_URL || 'http://unleash-server:4242/api',
  appName: 'pet-service',
  instanceId: uuidv4(),
  refreshInterval: 15000,
  metricsInterval: 10000,
  customHeaders: { Authorization: process.env.UNLEASH_API_TOKEN || 'default:development.unleash-insecure-api-token' }
});

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'pet-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Feature flag metrics
const featureFlagMetrics = {
  evaluations: {},
  latency: {},
  errors: 0
};

// Feature flag evaluation helper with metrics
function checkFeatureFlag(flagName, context = {}, defaultValue = false) {
  const startTime = Date.now();
  let result = defaultValue;
  
  try {
    if (!featureFlagMetrics.evaluations[flagName]) {
      featureFlagMetrics.evaluations[flagName] = { enabled: 0, disabled: 0 };
      featureFlagMetrics.latency[flagName] = [];
    }
    
    result = isEnabled(flagName, context);
    
    if (result) {
      featureFlagMetrics.evaluations[flagName].enabled++;
    } else {
      featureFlagMetrics.evaluations[flagName].disabled++;
    }
    
    const latency = Date.now() - startTime;
    featureFlagMetrics.latency[flagName].push(latency);
    
    // Keep only the last 100 latency measurements
    if (featureFlagMetrics.latency[flagName].length > 100) {
      featureFlagMetrics.latency[flagName].shift();
    }
    
    logger.debug(`Feature flag ${flagName} evaluated to ${result} in ${latency}ms`);
  } catch (error) {
    featureFlagMetrics.errors++;
    logger.error(`Error evaluating feature flag ${flagName}:`, error);
  }
  
  return result;
}

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
const tableName = process.env.DYNAMODB_TABLE || 'pet-hospital-pets';

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Feature flag metrics endpoint
app.get('/metrics/feature-flags', (req, res) => {
  // Calculate average latency for each flag
  const avgLatency = {};
  Object.keys(featureFlagMetrics.latency).forEach(flag => {
    const latencies = featureFlagMetrics.latency[flag];
    if (latencies.length > 0) {
      const sum = latencies.reduce((a, b) => a + b, 0);
      avgLatency[flag] = sum / latencies.length;
    } else {
      avgLatency[flag] = 0;
    }
  });
  
  res.status(200).json({
    evaluations: featureFlagMetrics.evaluations,
    avgLatency,
    errors: featureFlagMetrics.errors,
    flags: getFeatureToggleDefinitions()
  });
});

// Get all pets
app.get('/pets', async (req, res) => {
  try {
    const params = {
      TableName: tableName,
    };
    
    // Use feature flag to enable pagination
    if (checkFeatureFlag('enable-pet-pagination', { userId: req.query.userId })) {
      const limit = parseInt(req.query.limit) || 10;
      const lastEvaluatedKey = req.query.nextToken ? JSON.parse(Buffer.from(req.query.nextToken, 'base64').toString()) : undefined;
      
      params.Limit = limit;
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await dynamoDB.scan(params).promise();
      
      const response = {
        items: result.Items,
        count: result.Count
      };
      
      if (result.LastEvaluatedKey) {
        response.nextToken = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
      }
      
      res.status(200).json(response);
    } else {
      // Original behavior without pagination
      const result = await dynamoDB.scan(params).promise();
      res.status(200).json(result.Items);
    }
  } catch (error) {
    logger.error('Error fetching pets:', error);
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

// Get pet by ID
app.get('/pets/:id', async (req, res) => {
  try {
    const params = {
      TableName: tableName,
      Key: {
        id: req.params.id,
      },
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (!result.Item) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    // Use feature flag to enable enhanced pet details
    if (checkFeatureFlag('enable-enhanced-pet-details', { petId: req.params.id })) {
      // Simulate fetching additional data
      const enhancedPet = {
        ...result.Item,
        medicalHistory: await fetchMedicalHistory(req.params.id),
        vaccinations: await fetchVaccinations(req.params.id),
        lastVisit: await fetchLastVisit(req.params.id)
      };
      
      return res.status(200).json(enhancedPet);
    }
    
    res.status(200).json(result.Item);
  } catch (error) {
    logger.error(`Error fetching pet ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch pet' });
  }
});

// Simulate fetching additional pet data
async function fetchMedicalHistory(petId) {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 50));
  return [
    { date: new Date().toISOString(), description: 'Annual checkup', notes: 'Healthy' }
  ];
}

async function fetchVaccinations(petId) {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 30));
  return [
    { name: 'Rabies', date: new Date().toISOString(), validUntil: new Date(Date.now() + 31536000000).toISOString() }
  ];
}

async function fetchLastVisit(petId) {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 20));
  return { date: new Date().toISOString(), reason: 'Checkup', doctor: 'Dr. Smith' };
}

// Create pet
app.post('/pets', async (req, res) => {
  try {
    const { name, species, breed, age, ownerName, ownerContact } = req.body;
    
    // Use feature flag to enable enhanced validation
    if (checkFeatureFlag('enable-strict-validation', { species: species })) {
      if (!name || !species || !ownerName || !ownerContact || !age) {
        return res.status(400).json({ error: 'Missing required fields including age' });
      }
      
      // Enhanced species validation
      const validSpecies = ['dog', 'cat', 'bird', 'reptile', 'fish', 'small_mammal'];
      if (!validSpecies.includes(species.toLowerCase())) {
        return res.status(400).json({ error: 'Invalid species. Must be one of: ' + validSpecies.join(', ') });
      }
    } else {
      // Original validation
      if (!name || !species || !ownerName || !ownerContact) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
    }
    
    const pet = {
      id: uuidv4(),
      name,
      species,
      breed: breed || null,
      age: age || null,
      ownerName,
      ownerContact,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const params = {
      TableName: tableName,
      Item: pet,
    };
    
    await dynamoDB.put(params).promise();
    
    res.status(201).json(pet);
  } catch (error) {
    logger.error('Error creating pet:', error);
    res.status(500).json({ error: 'Failed to create pet' });
  }
});

// Update pet
app.put('/pets/:id', async (req, res) => {
  try {
    const { name, species, breed, age, ownerName, ownerContact } = req.body;
    
    // Check if pet exists
    const getParams = {
      TableName: tableName,
      Key: {
        id: req.params.id,
      },
    };
    
    const existingPet = await dynamoDB.get(getParams).promise();
    
    if (!existingPet.Item) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    // Update pet
    const updateParams = {
      TableName: tableName,
      Key: {
        id: req.params.id,
      },
      UpdateExpression: 'set #name = :name, species = :species, breed = :breed, age = :age, ownerName = :ownerName, ownerContact = :ownerContact, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#name': 'name', // 'name' is a reserved keyword in DynamoDB
      },
      ExpressionAttributeValues: {
        ':name': name || existingPet.Item.name,
        ':species': species || existingPet.Item.species,
        ':breed': breed || existingPet.Item.breed,
        ':age': age || existingPet.Item.age,
        ':ownerName': ownerName || existingPet.Item.ownerName,
        ':ownerContact': ownerContact || existingPet.Item.ownerContact,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    };
    
    const result = await dynamoDB.update(updateParams).promise();
    
    res.status(200).json(result.Attributes);
  } catch (error) {
    logger.error(`Error updating pet ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update pet' });
  }
});

// Delete pet
app.delete('/pets/:id', async (req, res) => {
  try {
    // Use feature flag to enable soft delete
    if (checkFeatureFlag('enable-soft-delete', { petId: req.params.id })) {
      // Check if pet exists
      const getParams = {
        TableName: tableName,
        Key: {
          id: req.params.id,
        },
      };
      
      const existingPet = await dynamoDB.get(getParams).promise();
      
      if (!existingPet.Item) {
        return res.status(404).json({ error: 'Pet not found' });
      }
      
      // Soft delete by updating status
      const updateParams = {
        TableName: tableName,
        Key: {
          id: req.params.id,
        },
        UpdateExpression: 'set deleted = :deleted, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':deleted': true,
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      };
      
      const result = await dynamoDB.update(updateParams).promise();
      
      res.status(200).json({ message: 'Pet soft-deleted successfully' });
    } else {
      // Original hard delete behavior
      const params = {
        TableName: tableName,
        Key: {
          id: req.params.id,
        },
        ReturnValues: 'ALL_OLD',
      };
      
      const result = await dynamoDB.delete(params).promise();
      
      if (!result.Attributes) {
        return res.status(404).json({ error: 'Pet not found' });
      }
      
      res.status(200).json({ message: 'Pet deleted successfully' });
    }
  } catch (error) {
    logger.error(`Error deleting pet ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete pet' });
  }
});

// Start server
app.listen(port, () => {
  logger.info(`Pet service listening on port ${port}`);
});

module.exports = app; // For testing
