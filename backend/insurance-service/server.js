const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const axios = require('axios');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'insurance-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

const app = express();
const port = process.env.PORT || 3000;

// External Insurance API configuration
const INSURANCE_API_BASE_URL = process.env.INSURANCE_API_URL || 'https://api.petinsurance.example.com/v2';
const INSURANCE_API_KEY = process.env.INSURANCE_API_KEY || 'default-api-key';

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
const tableName = process.env.DYNAMODB_TABLE || 'pet-hospital-insurance';

// External Insurance API client
const insuranceApiClient = axios.create({
  baseURL: INSURANCE_API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${INSURANCE_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-API-Version': '2.0'
  },
  timeout: 5000
});

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Get all insurance policies
app.get('/insurance', async (req, res) => {
  try {
    // First try to get data from the external API
    try {
      const apiResponse = await insuranceApiClient.get('/policies', {
        params: {
          limit: 100,
          offset: 0,
          status: 'active'
        }
      });
      
      // Transform the external API response to match our schema
      const transformedPolicies = apiResponse.data.policies.map(policy => ({
        id: policy.policy_id,
        policyNumber: policy.policy_number,
        petId: policy.pet_details.id,
        petName: policy.pet_details.name,
        ownerName: policy.owner_details.name,
        provider: policy.provider_name,
        plan: policy.plan_name,
        startDate: policy.start_date,
        endDate: policy.end_date,
        coverageAmount: policy.coverage_amount,
        monthlyPremium: policy.monthly_premium,
        status: policy.status,
        createdAt: policy.created_at,
        updatedAt: policy.updated_at
      }));
      
      return res.status(200).json(transformedPolicies);
    } catch (apiError) {
      logger.error('Error fetching from external insurance API:', apiError);
      logger.info('Falling back to DynamoDB');
      
      // Fallback to DynamoDB if external API fails
      const params = {
        TableName: tableName,
      };
      
      const result = await dynamoDB.scan(params).promise();
      
      res.status(200).json(result.Items);
    }
  } catch (error) {
    logger.error('Error fetching insurance policies:', error);
    res.status(500).json({ error: 'Failed to fetch insurance policies' });
  }
});

// Get insurance policy by ID
app.get('/insurance/:id', async (req, res) => {
  try {
    // First try to get data from the external API
    try {
      const apiResponse = await insuranceApiClient.get(`/policies/${req.params.id}`);
      
      // Transform the external API response to match our schema
      const policy = apiResponse.data;
      const transformedPolicy = {
        id: policy.policy_id,
        policyNumber: policy.policy_number,
        petId: policy.pet_details.id,
        petName: policy.pet_details.name,
        ownerName: policy.owner_details.name,
        provider: policy.provider_name,
        plan: policy.plan_name,
        startDate: policy.start_date,
        endDate: policy.end_date,
        coverageAmount: policy.coverage_amount,
        monthlyPremium: policy.monthly_premium,
        status: policy.status,
        createdAt: policy.created_at,
        updatedAt: policy.updated_at,
        coverageDetails: policy.coverage_details,
        claimHistory: policy.claim_history
      };
      
      return res.status(200).json(transformedPolicy);
    } catch (apiError) {
      logger.error(`Error fetching policy ${req.params.id} from external API:`, apiError);
      logger.info('Falling back to DynamoDB');
      
      // Fallback to DynamoDB if external API fails
      const params = {
        TableName: tableName,
        Key: {
          id: req.params.id,
        },
      };
      
      const result = await dynamoDB.get(params).promise();
      
      if (!result.Item) {
        return res.status(404).json({ error: 'Insurance policy not found' });
      }
      
      res.status(200).json(result.Item);
    }
  } catch (error) {
    logger.error(`Error fetching insurance policy ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch insurance policy' });
  }
});

// Create insurance policy
app.post('/insurance', async (req, res) => {
  try {
    const { petId, petName, ownerName, provider, plan, startDate, coverageAmount, monthlyPremium } = req.body;
    
    if (!petId || !petName || !ownerName || !provider || !plan || !startDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Calculate end date (1 year from start date)
    const start = new Date(startDate);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    const endDate = end.toISOString().split('T')[0];
    
    // First try to create policy in external API
    try {
      const apiResponse = await insuranceApiClient.post('/policies', {
        pet_details: {
          id: petId,
          name: petName
        },
        owner_details: {
          name: ownerName
        },
        provider_name: provider,
        plan_name: plan,
        start_date: startDate,
        end_date: endDate,
        coverage_amount: coverageAmount,
        monthly_premium: monthlyPremium
      });
      
      // Transform the external API response to match our schema
      const policy = apiResponse.data;
      const transformedPolicy = {
        id: policy.policy_id,
        policyNumber: policy.policy_number,
        petId: policy.pet_details.id,
        petName: policy.pet_details.name,
        ownerName: policy.owner_details.name,
        provider: policy.provider_name,
        plan: policy.plan_name,
        startDate: policy.start_date,
        endDate: policy.end_date,
        coverageAmount: policy.coverage_amount,
        monthlyPremium: policy.monthly_premium,
        status: policy.status,
        createdAt: policy.created_at,
        updatedAt: policy.updated_at
      };
      
      // Also save to DynamoDB for backup
      const dynamoPolicy = {
        ...transformedPolicy,
        id: transformedPolicy.id || uuidv4(),
        createdAt: transformedPolicy.createdAt || new Date().toISOString(),
        updatedAt: transformedPolicy.updatedAt || new Date().toISOString(),
      };
      
      const params = {
        TableName: tableName,
        Item: dynamoPolicy,
      };
      
      await dynamoDB.put(params).promise();
      
      return res.status(201).json(transformedPolicy);
    } catch (apiError) {
      logger.error('Error creating policy in external API:', apiError);
      logger.info('Falling back to DynamoDB only');
      
      // Fallback to DynamoDB if external API fails
      const policy = {
        id: uuidv4(),
        policyNumber: `POL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        petId,
        petName,
        ownerName,
        provider,
        plan,
        startDate,
        endDate,
        coverageAmount,
        monthlyPremium,
        status: 'Active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const params = {
        TableName: tableName,
        Item: policy,
      };
      
      await dynamoDB.put(params).promise();
      
      res.status(201).json(policy);
    }
  } catch (error) {
    logger.error('Error creating insurance policy:', error);
    res.status(500).json({ error: 'Failed to create insurance policy' });
  }
});

// Update insurance policy
app.put('/insurance/:id', async (req, res) => {
  try {
    const { provider, plan, coverageAmount, monthlyPremium, status } = req.body;
    
    // First try to update in external API
    try {
      const apiResponse = await insuranceApiClient.put(`/policies/${req.params.id}`, {
        provider_name: provider,
        plan_name: plan,
        coverage_amount: coverageAmount,
        monthly_premium: monthlyPremium,
        status: status
      });
      
      // Transform the external API response to match our schema
      const policy = apiResponse.data;
      const transformedPolicy = {
        id: policy.policy_id,
        policyNumber: policy.policy_number,
        petId: policy.pet_details.id,
        petName: policy.pet_details.name,
        ownerName: policy.owner_details.name,
        provider: policy.provider_name,
        plan: policy.plan_name,
        startDate: policy.start_date,
        endDate: policy.end_date,
        coverageAmount: policy.coverage_amount,
        monthlyPremium: policy.monthly_premium,
        status: policy.status,
        updatedAt: policy.updated_at
      };
      
      // Also update in DynamoDB for backup
      const getParams = {
        TableName: tableName,
        Key: {
          id: req.params.id,
        },
      };
      
      const existingPolicy = await dynamoDB.get(getParams).promise();
      
      if (!existingPolicy.Item) {
        // If not in DynamoDB, save the transformed policy
        const params = {
          TableName: tableName,
          Item: transformedPolicy,
        };
        
        await dynamoDB.put(params).promise();
      } else {
        // Update existing record in DynamoDB
        const updateParams = {
          TableName: tableName,
          Key: {
            id: req.params.id,
          },
          UpdateExpression: 'set provider = :provider, plan = :plan, coverageAmount = :coverageAmount, monthlyPremium = :monthlyPremium, status = :status, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':provider': provider || existingPolicy.Item.provider,
            ':plan': plan || existingPolicy.Item.plan,
            ':coverageAmount': coverageAmount || existingPolicy.Item.coverageAmount,
            ':monthlyPremium': monthlyPremium || existingPolicy.Item.monthlyPremium,
            ':status': status || existingPolicy.Item.status,
            ':updatedAt': new Date().toISOString(),
          },
          ReturnValues: 'ALL_NEW',
        };
        
        await dynamoDB.update(updateParams).promise();
      }
      
      return res.status(200).json(transformedPolicy);
    } catch (apiError) {
      logger.error(`Error updating policy ${req.params.id} in external API:`, apiError);
      logger.info('Falling back to DynamoDB only');
      
      // Fallback to DynamoDB if external API fails
      // Check if policy exists
      const getParams = {
        TableName: tableName,
        Key: {
          id: req.params.id,
        },
      };
      
      const existingPolicy = await dynamoDB.get(getParams).promise();
      
      if (!existingPolicy.Item) {
        return res.status(404).json({ error: 'Insurance policy not found' });
      }
      
      // Update policy
      const updateParams = {
        TableName: tableName,
        Key: {
          id: req.params.id,
        },
        UpdateExpression: 'set provider = :provider, plan = :plan, coverageAmount = :coverageAmount, monthlyPremium = :monthlyPremium, status = :status, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':provider': provider || existingPolicy.Item.provider,
          ':plan': plan || existingPolicy.Item.plan,
          ':coverageAmount': coverageAmount || existingPolicy.Item.coverageAmount,
          ':monthlyPremium': monthlyPremium || existingPolicy.Item.monthlyPremium,
          ':status': status || existingPolicy.Item.status,
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      };
      
      const result = await dynamoDB.update(updateParams).promise();
      
      res.status(200).json(result.Attributes);
    }
  } catch (error) {
    logger.error(`Error updating insurance policy ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update insurance policy' });
  }
});

// Delete insurance policy
app.delete('/insurance/:id', async (req, res) => {
  try {
    // First try to delete in external API
    try {
      await insuranceApiClient.delete(`/policies/${req.params.id}`);
      
      // Also delete from DynamoDB
      const params = {
        TableName: tableName,
        Key: {
          id: req.params.id,
        },
        ReturnValues: 'ALL_OLD',
      };
      
      const result = await dynamoDB.delete(params).promise();
      
      return res.status(200).json({ message: 'Insurance policy deleted successfully' });
    } catch (apiError) {
      logger.error(`Error deleting policy ${req.params.id} from external API:`, apiError);
      logger.info('Falling back to DynamoDB only');
      
      // Fallback to DynamoDB if external API fails
      const params = {
        TableName: tableName,
        Key: {
          id: req.params.id,
        },
        ReturnValues: 'ALL_OLD',
      };
      
      const result = await dynamoDB.delete(params).promise();
      
      if (!result.Attributes) {
        return res.status(404).json({ error: 'Insurance policy not found' });
      }
      
      res.status(200).json({ message: 'Insurance policy deleted successfully' });
    }
  } catch (error) {
    logger.error(`Error deleting insurance policy ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete insurance policy' });
  }
});

// Get insurance providers
app.get('/insurance/providers', async (req, res) => {
  try {
    // Try to get providers from external API
    try {
      const apiResponse = await insuranceApiClient.get('/providers');
      
      // Transform the external API response to match our schema
      const providers = apiResponse.data.providers.map(provider => ({
        id: provider.id,
        name: provider.name,
        description: provider.description,
        website: provider.website,
        contactEmail: provider.contact_email,
        contactPhone: provider.contact_phone
      }));
      
      return res.status(200).json(providers);
    } catch (apiError) {
      logger.error('Error fetching insurance providers from external API:', apiError);
      
      // Return mock data as fallback
      const mockProviders = [
        { id: 1, name: 'PetCare Insurance', description: 'Comprehensive pet insurance', website: 'https://petcare.example.com' },
        { id: 2, name: 'Animal Health Insurance', description: 'Affordable pet insurance', website: 'https://animalhealth.example.com' },
        { id: 3, name: 'VetGuard Insurance', description: 'Premium pet insurance', website: 'https://vetguard.example.com' },
        { id: 4, name: 'PawProtect', description: 'Basic pet insurance', website: 'https://pawprotect.example.com' }
      ];
      
      res.status(200).json(mockProviders);
    }
  } catch (error) {
    logger.error('Error fetching insurance providers:', error);
    res.status(500).json({ error: 'Failed to fetch insurance providers' });
  }
});

// Get insurance plans by provider
app.get('/insurance/providers/:providerId/plans', async (req, res) => {
  try {
    // Try to get plans from external API
    try {
      const apiResponse = await insuranceApiClient.get(`/providers/${req.params.providerId}/plans`);
      
      // Transform the external API response to match our schema
      const plans = apiResponse.data.plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        provider: plan.provider_name,
        coverageAmount: plan.coverage_amount,
        monthlyPremium: plan.monthly_premium,
        description: plan.description,
        benefits: plan.benefits
      }));
      
      return res.status(200).json(plans);
    } catch (apiError) {
      logger.error(`Error fetching plans for provider ${req.params.providerId} from external API:`, apiError);
      
      // Return mock data as fallback
      const mockPlans = [
        { id: 1, name: 'Basic', provider: 'PetCare Insurance', coverageAmount: 3000, monthlyPremium: 30 },
        { id: 2, name: 'Standard', provider: 'PetCare Insurance', coverageAmount: 4000, monthlyPremium: 35 },
        { id: 3, name: 'Premium', provider: 'PetCare Insurance', coverageAmount: 5000, monthlyPremium: 45 },
        { id: 4, name: 'Basic', provider: 'Animal Health Insurance', coverageAmount: 3000, monthlyPremium: 30 },
        { id: 5, name: 'Premium', provider: 'Animal Health Insurance', coverageAmount: 5000, monthlyPremium: 40 },
        { id: 6, name: 'Standard', provider: 'VetGuard Insurance', coverageAmount: 4000, monthlyPremium: 38 },
        { id: 7, name: 'Premium', provider: 'VetGuard Insurance', coverageAmount: 6000, monthlyPremium: 50 },
        { id: 8, name: 'Basic', provider: 'PawProtect', coverageAmount: 2500, monthlyPremium: 25 },
        { id: 9, name: 'Premium', provider: 'PawProtect', coverageAmount: 5500, monthlyPremium: 48 }
      ].filter(plan => plan.provider === req.params.providerId);
      
      res.status(200).json(mockPlans);
    }
  } catch (error) {
    logger.error(`Error fetching plans for provider ${req.params.providerId}:`, error);
    res.status(500).json({ error: 'Failed to fetch insurance plans' });
  }
});

// Start server
app.listen(port, () => {
  logger.info(`Insurance service listening on port ${port}`);
});

module.exports = app; // For testing