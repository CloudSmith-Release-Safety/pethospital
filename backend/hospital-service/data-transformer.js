const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'data-transformer' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

class DataTransformer {
  
  /**
   * Transform hospital data through the complete pipeline
   */
  static async transformHospitalData(rawData, operation = 'create') {
    try {
      logger.info('Starting data transformation', { 
        operation, 
        hospitalName: rawData.name 
      });

      let transformedData = { ...rawData };
      
      // Step 1: Data validation and sanitization
      transformedData = this.sanitizeData(transformedData);
      
      // Step 2: Format standardization
      transformedData = this.standardizeFormats(transformedData);
      
      // Step 3: Data enrichment
      transformedData = await this.enrichData(transformedData);
      
      // Step 4: Data quality scoring
      transformedData = this.calculateDataQuality(transformedData);
      
      // Step 5: Add transformation metadata
      transformedData = this.addTransformationMetadata(transformedData, operation);
      
      logger.info('Data transformation completed', {
        hospitalId: transformedData.id,
        qualityScore: transformedData.dataQuality?.overallScore,
        transformationsApplied: transformedData.transformationMetadata?.transformationsApplied
      });
      
      return transformedData;
    } catch (error) {
      logger.error('Data transformation failed', {
        error: error.message,
        hospitalName: rawData.name
      });
      throw new Error(`Data transformation failed: ${error.message}`);
    }
  }

  /**
   * Sanitize and clean input data
   */
  static sanitizeData(data) {
    const sanitized = { ...data };
    
    // Trim whitespace from string fields
    if (sanitized.name) sanitized.name = sanitized.name.trim();
    if (sanitized.address) sanitized.address = sanitized.address.trim();
    if (sanitized.email) sanitized.email = sanitized.email.trim().toLowerCase();
    
    // Remove invalid characters from phone
    if (sanitized.phone) {
      sanitized.phone = sanitized.phone.replace(/[^\d\+\-\(\)\s]/g, '');
    }
    
    // Sanitize services array
    if (sanitized.services && Array.isArray(sanitized.services)) {
      sanitized.services = sanitized.services
        .map(service => service.trim())
        .filter(service => service.length > 0);
    }
    
    // Validate and sanitize capacity
    if (sanitized.capacity) {
      const capacity = parseInt(sanitized.capacity);
      sanitized.capacity = isNaN(capacity) ? null : Math.max(0, capacity);
    }
    
    logger.debug('Data sanitization completed', { 
      hospitalName: sanitized.name 
    });
    
    return sanitized;
  }

  /**
   * Standardize data formats
   */
  static standardizeFormats(data) {
    const standardized = { ...data };
    
    // Standardize phone number format
    if (standardized.phone) {
      standardized.phone = this.standardizePhoneNumber(standardized.phone);
    }
    
    // Standardize address format
    if (standardized.address) {
      standardized.address = this.standardizeAddress(standardized.address);
    }
    
    // Standardize services
    if (standardized.services) {
      standardized.services = this.standardizeServices(standardized.services);
    }
    
    // Standardize operating hours
    if (standardized.operatingHours) {
      standardized.operatingHours = this.standardizeOperatingHours(standardized.operatingHours);
    }
    
    logger.debug('Format standardization completed', { 
      hospitalName: standardized.name 
    });
    
    return standardized;
  }

  /**
   * Enrich data with additional information
   */
  static async enrichData(data) {
    const enriched = { ...data };
    
    // Add geocoding information (simulated)
    if (enriched.address) {
      enriched.location = await this.geocodeAddress(enriched.address);
    }
    
    // Add service categories
    if (enriched.services) {
      enriched.serviceCategories = this.categorizeServices(enriched.services);
    }
    
    // Add capacity tier
    if (enriched.capacity) {
      enriched.capacityTier = this.calculateCapacityTier(enriched.capacity);
    }
    
    // Add operational metrics
    enriched.operationalMetrics = this.calculateOperationalMetrics(enriched);
    
    logger.debug('Data enrichment completed', { 
      hospitalName: enriched.name,
      location: enriched.location,
      capacityTier: enriched.capacityTier
    });
    
    return enriched;
  }

  /**
   * Calculate data quality score
   */
  static calculateDataQuality(data) {
    const qualityData = { ...data };
    
    const qualityMetrics = {
      completeness: this.calculateCompleteness(data),
      accuracy: this.calculateAccuracy(data),
      consistency: this.calculateConsistency(data),
      validity: this.calculateValidity(data)
    };
    
    // Calculate overall quality score (0-100)
    const overallScore = Math.round(
      (qualityMetrics.completeness * 0.3 +
       qualityMetrics.accuracy * 0.3 +
       qualityMetrics.consistency * 0.2 +
       qualityMetrics.validity * 0.2)
    );
    
    qualityData.dataQuality = {
      ...qualityMetrics,
      overallScore,
      assessedAt: new Date().toISOString()
    };
    
    logger.debug('Data quality assessment completed', {
      hospitalName: data.name,
      overallScore
    });
    
    return qualityData;
  }

  /**
   * Add transformation metadata
   */
  static addTransformationMetadata(data, operation) {
    const metadataData = { ...data };
    
    metadataData.transformationMetadata = {
      transformedAt: new Date().toISOString(),
      transformationVersion: '1.0.0',
      operation: operation,
      transformationsApplied: [
        'sanitization',
        'format_standardization',
        'data_enrichment',
        'quality_assessment'
      ],
      processingDuration: Date.now() // Will be updated with actual duration
    };
    
    return metadataData;
  }

  // Helper methods for standardization
  static standardizePhoneNumber(phone) {
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d\+]/g, '');
    
    // Handle US phone numbers
    if (cleaned.length === 10) {
      return `+1-${cleaned.slice(0,3)}-${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned.slice(0,1)}-${cleaned.slice(1,4)}-${cleaned.slice(4,7)}-${cleaned.slice(7)}`;
    }
    
    return phone; // Return original if can't standardize
  }

  static standardizeAddress(address) {
    return address
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\b(st|street)\b/gi, 'Street')
      .replace(/\b(ave|avenue)\b/gi, 'Avenue')
      .replace(/\b(rd|road)\b/gi, 'Road')
      .replace(/\b(blvd|boulevard)\b/gi, 'Boulevard')
      .trim();
  }

  static standardizeServices(services) {
    const serviceMap = {
      'emergency': 'Emergency Care',
      'er': 'Emergency Care',
      'urgent care': 'Urgent Care',
      'surgery': 'Surgical Services',
      'cardiology': 'Cardiology',
      'orthopedics': 'Orthopedic Services',
      'pediatrics': 'Pediatric Care',
      'maternity': 'Maternity Care',
      'radiology': 'Radiology Services',
      'lab': 'Laboratory Services'
    };
    
    return services.map(service => {
      const normalized = service.toLowerCase().trim();
      return serviceMap[normalized] || service;
    });
  }

  static standardizeOperatingHours(hours) {
    // Convert various time formats to standard 24-hour format
    const standardized = {};
    
    Object.keys(hours).forEach(day => {
      if (hours[day]) {
        standardized[day.toLowerCase()] = this.standardizeTimeRange(hours[day]);
      }
    });
    
    return standardized;
  }

  static standardizeTimeRange(timeRange) {
    // Simple time standardization (would be more complex in real implementation)
    return timeRange.replace(/(\d{1,2}):(\d{2})\s*(am|pm)/gi, (match, hour, minute, period) => {
      let h = parseInt(hour);
      if (period.toLowerCase() === 'pm' && h !== 12) h += 12;
      if (period.toLowerCase() === 'am' && h === 12) h = 0;
      return `${h.toString().padStart(2, '0')}:${minute}`;
    });
  }

  // Helper methods for enrichment
  static async geocodeAddress(address) {
    // Simulate geocoding API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return mock coordinates based on address hash
    const hash = address.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return {
      latitude: 40.7128 + (hash % 1000) / 10000,
      longitude: -74.0060 + (hash % 1000) / 10000,
      geocodedAt: new Date().toISOString()
    };
  }

  static categorizeServices(services) {
    const categories = {
      'Emergency': ['Emergency Care', 'Urgent Care'],
      'Surgical': ['Surgical Services', 'Orthopedic Services'],
      'Diagnostic': ['Radiology Services', 'Laboratory Services'],
      'Specialty': ['Cardiology', 'Pediatric Care', 'Maternity Care']
    };
    
    const serviceCategories = [];
    
    Object.keys(categories).forEach(category => {
      if (services.some(service => categories[category].includes(service))) {
        serviceCategories.push(category);
      }
    });
    
    return serviceCategories;
  }

  static calculateCapacityTier(capacity) {
    if (capacity < 50) return 'Small';
    if (capacity < 200) return 'Medium';
    if (capacity < 500) return 'Large';
    return 'Extra Large';
  }

  static calculateOperationalMetrics(data) {
    return {
      serviceCount: data.services ? data.services.length : 0,
      hasEmergencyServices: data.services ? data.services.some(s => s.includes('Emergency')) : false,
      operatingDaysCount: data.operatingHours ? Object.keys(data.operatingHours).length : 0,
      contactMethodsCount: [data.phone, data.email].filter(Boolean).length
    };
  }

  // Quality assessment methods
  static calculateCompleteness(data) {
    const requiredFields = ['name', 'address', 'phone'];
    const optionalFields = ['email', 'capacity', 'services', 'operatingHours'];
    
    const requiredComplete = requiredFields.filter(field => data[field]).length;
    const optionalComplete = optionalFields.filter(field => data[field]).length;
    
    return Math.round(
      (requiredComplete / requiredFields.length * 70) +
      (optionalComplete / optionalFields.length * 30)
    );
  }

  static calculateAccuracy(data) {
    let score = 100;
    
    // Check phone number format
    if (data.phone && !data.phone.match(/^\+\d{1,3}-\d{3}-\d{3}-\d{4}$/)) {
      score -= 20;
    }
    
    // Check email format
    if (data.email && !data.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      score -= 15;
    }
    
    // Check capacity reasonableness
    if (data.capacity && (data.capacity < 1 || data.capacity > 10000)) {
      score -= 10;
    }
    
    return Math.max(0, score);
  }

  static calculateConsistency(data) {
    let score = 100;
    
    // Check if services match capacity tier
    if (data.services && data.capacity) {
      const hasSpecialtyServices = data.services.length > 5;
      const isLargeCapacity = data.capacity > 200;
      
      if (hasSpecialtyServices !== isLargeCapacity) {
        score -= 15;
      }
    }
    
    return Math.max(0, score);
  }

  static calculateValidity(data) {
    let score = 100;
    
    // Validate required fields are not empty
    if (!data.name || data.name.length < 2) score -= 30;
    if (!data.address || data.address.length < 10) score -= 25;
    if (!data.phone) score -= 20;
    
    return Math.max(0, score);
  }
}

module.exports = DataTransformer;
