import AsyncStorage from '@react-native-async-storage/async-storage';
import { Location } from '../types/liveTracking';
import EventEmitter from './EventEmitter';

const QUEUE_KEY = 'locationQueue';
const MAX_QUEUE_SIZE = 200;

interface QueuedLocation extends Location {
  queuedAt?: number;
}

/**
 * Adds a location to the queue for later processing
 */
export async function queueLocation(location: Location): Promise<void> {
  try {
    const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
    let queue: QueuedLocation[] = queueStr ? JSON.parse(queueStr) : [];
    
    // Add to queue with timestamp
    queue.push({
      ...location,
      queuedAt: Date.now()
    });
    
    // Limit queue size
    if (queue.length > MAX_QUEUE_SIZE) {
      queue = queue.slice(-MAX_QUEUE_SIZE);
    }
    
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    
    // Emit event
    EventEmitter.emit('locationQueued', { queueSize: queue.length });
  } catch (error) {
    console.error('Error queueing location:', error);
  }
}

/**
 * Gets all queued locations
 */
export async function getQueuedLocations(): Promise<QueuedLocation[]> {
  try {
    const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
    return queueStr ? JSON.parse(queueStr) : [];
  } catch (error) {
    console.error('Error getting queued locations:', error);
    return [];
  }
}

/**
 * Clears the location queue
 */
export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
    EventEmitter.emit('locationQueueCleared');
  } catch (error) {
    console.error('Error clearing location queue:', error);
  }
}

/**
 * Removes specific indices from the queue
 */
export async function removeFromQueue(indices: number[]): Promise<void> {
  try {
    const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
    if (!queueStr) return;
    
    const queue: QueuedLocation[] = JSON.parse(queueStr);
    const newQueue = queue.filter((_, index) => !indices.includes(index));
    
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
    
    EventEmitter.emit('locationsRemovedFromQueue', { 
      removed: indices.length,
      remaining: newQueue.length
    });
  } catch (error) {
    console.error('Error removing locations from queue:', error);
  }
}

/**
 * Gets the current queue size
 */
export async function getQueueSize(): Promise<number> {
  try {
    const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
    if (!queueStr) return 0;
    
    const queue: QueuedLocation[] = JSON.parse(queueStr);
    return queue.length;
  } catch (error) {
    console.error('Error getting queue size:', error);
    return 0;
  }
}

/**
 * Adds a batch of locations to the queue
 */
export async function queueLocationBatch(locations: Location[]): Promise<void> {
  try {
    if (!locations.length) return;
    
    const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
    let queue: QueuedLocation[] = queueStr ? JSON.parse(queueStr) : [];
    
    // Add all locations with timestamps
    const locationsWithTimestamps: QueuedLocation[] = locations.map(loc => ({
      ...loc,
      queuedAt: Date.now()
    }));
    
    queue = [...queue, ...locationsWithTimestamps];
    
    // Limit queue size
    if (queue.length > MAX_QUEUE_SIZE) {
      queue = queue.slice(-MAX_QUEUE_SIZE);
    }
    
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    
    EventEmitter.emit('locationBatchQueued', { 
      batchSize: locations.length,
      queueSize: queue.length
    });
  } catch (error) {
    console.error('Error queueing location batch:', error);
  }
} 