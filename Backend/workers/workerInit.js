// workers/workerInit.js - Pre-initialize models to prevent DB connection exhaustion
let modelsCache = null;
let isInitialized = false;
let initializationPromise = null;

const initializeWorkerModels = async () => {
  if (isInitialized) return modelsCache;
  
  // If initialization is in progress, return the existing promise
  if (initializationPromise) {
    return initializationPromise;
  }
  
  // Start initialization
  initializationPromise = (async () => {
    try {
      console.log('🔄 Initializing worker models...');
      
      const { getModels } = require('../models');
      modelsCache = await getModels();
      isInitialized = true;
      
      console.log('✅ Worker models initialized successfully');
      return modelsCache;
    } catch (error) {
      console.error('❌ Failed to initialize worker models:', error);
      isInitialized = false;
      initializationPromise = null;
      throw error;
    }
  })();
  
  return initializationPromise;
};

const getWorkerModels = () => {
  if (!isInitialized || !modelsCache) {
    throw new Error('Worker models not initialized. Call initializeWorkerModels() first.');
  }
  return modelsCache;
};

const isWorkerModelsReady = () => {
  return isInitialized && modelsCache !== null;
};

module.exports = { 
  initializeWorkerModels, 
  getWorkerModels, 
  isWorkerModelsReady 
}; 