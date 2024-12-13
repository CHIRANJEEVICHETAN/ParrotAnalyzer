import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function diagnoseServerIssues() {
  console.log('Starting server diagnostics...');

  // Check environment variables
  console.log('\nChecking environment variables:');
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'EMAIL_USER', 'EMAIL_PASS'];
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar} is set`);
    } else {
      console.log(`❌ ${envVar} is missing`);
    }
  }

  // Test database connection
  console.log('\nTesting database connection:');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to the database');
    client.release();
  } catch (error) {
    console.log('❌ Failed to connect to the database');
    console.error(error);
  }

  // Check for syntax errors
  console.log('\nChecking for syntax errors:');
  try {
    await import('./server.ts');
    console.log('✅ No syntax errors detected');
  } catch (error) {
    console.log('❌ Syntax error detected:');
    console.error(error);
  }

  console.log('\nDiagnostics complete. Check the logs above for any issues.');
}

diagnoseServerIssues();