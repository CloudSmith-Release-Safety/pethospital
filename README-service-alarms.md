# Pet Hospital Service-Specific CloudWatch Alarms

This PR adds CloudWatch alarms that are **directly correlated** to the error handling changes in the pet hospital backend services.

## Alarms Created (9 total)

### **Pod Restart Monitoring** - Detects if error handling changes cause crashes:
1. `pet-hospital-pet-service-pod-restarts` - Pet service pod restarts
2. `pet-hospital-doctor-service-pod-restarts` - Doctor service pod restarts  
3. `pet-hospital-hospital-service-pod-restarts` - Hospital service pod restarts

### **Memory Usage Monitoring** - Detects memory increase from structured error objects:
4. `pet-hospital-pet-service-memory-high` - Pet service memory usage
5. `pet-hospital-doctor-service-memory-high` - Doctor service memory usage
6. `pet-hospital-hospital-service-memory-high` - Hospital service memory usage

### **CPU Usage Monitoring** - Detects CPU increase from error object processing:
7. `pet-hospital-pet-service-cpu-high` - Pet service CPU usage
8. `pet-hospital-doctor-service-cpu-high` - Doctor service CPU usage
9. `pet-hospital-hospital-service-cpu-high` - Hospital service CPU usage

## Direct Correlation to Error Handling PR

These alarms monitor the **exact services being changed** in the error handling PR:
- **pet-service** - Modified in `backend/pet-service/server.js`
- **doctor-service** - Modified in `backend/doctor-service/server.js`  
- **hospital-service** - Modified in `backend/hospital-service/server.js`

## Monitoring Impact of Changes

The structured error response changes could cause:
- **Pod restarts** - If new error handling code has bugs
- **Memory increase** - From creating error objects with timestamps/requestIds
- **CPU increase** - From additional JSON processing overhead

## Deployment

```bash
# Deploy service-specific alarms
./deploy-service-alarms.sh
```

These alarms will provide **direct monitoring** of the services affected by the error handling enhancement.
