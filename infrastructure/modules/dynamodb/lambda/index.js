const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB();
const backup = new AWS.Backup();

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Get the table name from the alarm
    const alarmName = event.detail.alarmName;
    const tableName = alarmName.split('-')[0];
    
    console.log(`Processing rollback for table: ${tableName}`);
    
    // Get the latest backup
    const backupVaultName = process.env.BACKUP_VAULT_NAME;
    const backups = await backup.listBackupJobs({
      BackupVaultName: backupVaultName,
      ByResource: `arn:aws:dynamodb:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:table/${tableName}`
    }).promise();
    
    if (!backups.BackupJobs || backups.BackupJobs.length === 0) {
      console.error(`No backups found for table ${tableName}`);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `No backups found for table ${tableName}` })
      };
    }
    
    // Sort backups by completion time (newest first)
    const sortedBackups = backups.BackupJobs.sort((a, b) => 
      new Date(b.CompletionDate) - new Date(a.CompletionDate)
    );
    
    const latestBackup = sortedBackups[0];
    console.log(`Latest backup: ${JSON.stringify(latestBackup)}`);
    
    // Start the restore job
    const restoreParams = {
      BackupArn: latestBackup.BackupArn,
      TargetTableName: `${tableName}-restored`,
      RestoreMetadata: {
        'restore-source': tableName,
        'restore-date': new Date().toISOString()
      }
    };
    
    const restoreResult = await backup.startRestoreJob(restoreParams).promise();
    console.log(`Restore job started: ${JSON.stringify(restoreResult)}`);
    
    // Wait for restore to complete
    console.log('Waiting for restore to complete...');
    
    // After restore completes, verify data and swap tables
    // This is a simplified version - in production, you would implement a more robust solution
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Rollback procedure initiated',
        restoreJobId: restoreResult.RestoreJobId
      })
    };
  } catch (error) {
    console.error('Error during rollback:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error during rollback', error: error.message })
    };
  }
};