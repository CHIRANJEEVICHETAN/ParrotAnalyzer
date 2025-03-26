const { Expo } = require('expo-server-sdk');
const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create a new Expo SDK client
const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

async function testExpoPushNotifications() {
  try {
    console.log('Starting Expo Push Notification Test...');
    
    // 1. Get a valid Expo Push Token from your database
    console.log('Fetching a token from the database...');
    const tokenResult = await pool.query(
      'SELECT token FROM device_tokens WHERE is_active = true LIMIT 1'
    );
    
    if (tokenResult.rows.length === 0) {
      console.error('No active device tokens found in the database.');
      return;
    }
    
    const token = tokenResult.rows[0].token;
    console.log(`Found token: ${token}`);
    
    // 2. Validate the token format
    if (!Expo.isExpoPushToken(token)) {
      console.error(`Invalid Expo push token: ${token}`);
      return;
    }
    
    console.log('Token is valid.');
    
    // 3. Prepare a test message
    const message = {
      to: token,
      sound: 'default',
      title: 'Test Notification',
      body: 'This is a test notification from the diagnostic script.',
      data: { testData: 'diagnostic' },
      priority: 'high',
    };
    
    console.log('Message prepared:', message);
    
    // 4. Send the test message
    console.log('Sending test message to Expo...');
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];
    
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log('Response from Expo:', JSON.stringify(ticketChunk, null, 2));
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending notifications:', error);
      }
    }
    
    // 5. Check for errors in the response
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        console.error(`Error ticket: ${JSON.stringify(ticket, null, 2)}`);
      }
    }
    
    console.log('Test completed.');
  } catch (error) {
    console.error('Fatal error during test:', error);
  } finally {
    await pool.end();
  }
}

testExpoPushNotifications(); 