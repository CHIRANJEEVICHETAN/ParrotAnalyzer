import { EventEmitter } from 'events';

// Create a singleton instance
const eventEmitter = new EventEmitter();

// Increase the max listeners to prevent memory leak warnings
eventEmitter.setMaxListeners(50);

export default eventEmitter; 