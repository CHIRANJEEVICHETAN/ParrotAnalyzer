import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import axios from 'axios';
import EventEmitter from './EventEmitter';

const QUEUE_KEY = 'locationUpdateQueue';
const MAX_QUEUE_SIZE = 100;
const MAX_BATCH_SIZE = 5;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Sends a batch of location updates via HTTP
 * Handles offline scenarios by queueing the updates
 */
export async function sendHttpBatch(endpoint: string, data: any, token: string): Promise<boolean> {
  try {
    // Check connectivity
    const networkState = await Network.getNetworkStateAsync();
    
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      console.log('No connectivity, queueing location update');
      await queueUpdate({
        endpoint,
        data,
        timestamp: Date.now()
      });
      return false;
    }
    
    // Attempt to send
    await axios.post(endpoint, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
    
    // Also process any queued updates
    await processQueue(token);
    
    // Emit event for successful location update
    EventEmitter.emit('locationUpdateSent', { success: true });
    
    return true;
  } catch (error: any) {
    console.error('HTTP batch send error:', error);
    
    // Queue the failed update
    await queueUpdate({
      endpoint,
      data,
      timestamp: Date.now()
    });
    
    // Emit event for failed location update
    EventEmitter.emit('locationUpdateSent', { 
      success: false, 
      error: error.message || 'Unknown error' 
    });
    
    return false;
  }
}

/**
 * Adds a location update to the queue for later processing
 */
async function queueUpdate(update: any): Promise<void> {
  try {
    const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
    let queue = queueStr ? JSON.parse(queueStr) : [];
    
    // Add to queue
    queue.push(update);
    
    // Trim queue if needed
    if (queue.length > MAX_QUEUE_SIZE) {
      queue = queue.slice(-MAX_QUEUE_SIZE);
    }
    
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    
    // Emit event for queued update
    EventEmitter.emit('locationUpdateQueued', { queueSize: queue.length });
  } catch (error) {
    console.error('Error queueing update:', error);
  }
}

/**
 * Processes the queued updates when connectivity is available
 */
export async function processQueue(token: string): Promise<void> {
  try {
    const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
    if (!queueStr) return;
    
    const queue = JSON.parse(queueStr);
    if (!queue.length) return;
    
    console.log(`Processing ${queue.length} queued updates`);
    
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || !networkState.isInternetReachable) return;
    
    const successfulIndices: number[] = [];
    
    // Process in batches
    for (let i = 0; i < Math.min(queue.length, MAX_BATCH_SIZE); i++) {
      try {
        const update = queue[i];
        
        // Skip if too old
        if (Date.now() - update.timestamp > MAX_AGE_MS) {
          successfulIndices.push(i);
          continue;
        }
        
        await axios.post(update.endpoint, update.data, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        successfulIndices.push(i);
      } catch (error) {
        console.error(`Failed to process queued update at index ${i}:`, error);
      }
    }
    
    // Remove successful updates from queue
    if (successfulIndices.length) {
      const newQueue = queue.filter((_: any, index: number) => !successfulIndices.includes(index));
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
      
      // Emit event for queue processing
      EventEmitter.emit('queueProcessed', { 
        processedCount: successfulIndices.length,
        remainingCount: newQueue.length
      });
    }
  } catch (error) {
    console.error('Error processing update queue:', error);
  }
}

/**
 * Gets the current queue size
 */
export async function getQueueSize(): Promise<number> {
  try {
    const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
    if (!queueStr) return 0;
    
    const queue = JSON.parse(queueStr);
    return queue.length;
  } catch (error) {
    console.error('Error getting queue size:', error);
    return 0;
  }
}

/**
 * Clears the queue
 */
export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
    
    // Emit event for queue cleared
    EventEmitter.emit('queueCleared');
  } catch (error) {
    console.error('Error clearing queue:', error);
  }
} 