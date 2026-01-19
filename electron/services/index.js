/**
 * Electron AGT Services Index
 * Exports all local-first AGT compliance services for Electron main process
 */

const rsaSigning = require('./rsaSigning');
const agtClient = require('./agtClient');
const auditLog = require('./auditLog');
const serverDiscovery = require('./serverDiscovery');

module.exports = {
  // RSA Signing
  ...rsaSigning,
  
  // AGT Client
  AGTClient: agtClient.AGTClient,
  AGT_ERROR_CODES: agtClient.AGT_ERROR_CODES,
  validateAGTConfig: agtClient.validateConfig,
  
  // Audit Logging
  AuditLogService: auditLog.AuditLogService,
  AUDIT_ACTIONS: auditLog.AUDIT_ACTIONS,
  ENTITY_TYPES: auditLog.ENTITY_TYPES,
  createAuditLogger: auditLog.createAuditLogger,
  
  // Server Discovery
  serverDiscovery: serverDiscovery.serverDiscovery,
  DISCOVERY_PORT: serverDiscovery.DISCOVERY_PORT
};
