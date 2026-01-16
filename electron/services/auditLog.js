/**
 * Tamper-Evident Audit Log Service
 * Hash-chained audit trail for AGT compliance
 */

const crypto = require('crypto');
const { Pool } = require('pg');

// Action types for audit logging
const AUDIT_ACTIONS = {
  // Invoice actions
  INVOICE_CREATED: 'invoice_created',
  INVOICE_SIGNED: 'invoice_signed',
  INVOICE_TRANSMITTED: 'invoice_transmitted',
  INVOICE_VALIDATED: 'invoice_validated',
  INVOICE_VOIDED: 'invoice_voided',
  
  // Document actions
  CREDIT_NOTE_CREATED: 'credit_note_created',
  CREDIT_NOTE_ISSUED: 'credit_note_issued',
  DEBIT_NOTE_CREATED: 'debit_note_created',
  DEBIT_NOTE_ISSUED: 'debit_note_issued',
  
  // User actions
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  
  // System actions
  KEY_GENERATED: 'key_generated',
  KEY_REVOKED: 'key_revoked',
  SAFT_EXPORTED: 'saft_exported',
  SETTINGS_CHANGED: 'settings_changed',
  
  // Stock actions
  STOCK_ADJUSTED: 'stock_adjusted',
  STOCK_TRANSFERRED: 'stock_transferred'
};

// Entity types
const ENTITY_TYPES = {
  INVOICE: 'invoice',
  CREDIT_NOTE: 'credit_note',
  DEBIT_NOTE: 'debit_note',
  PRODUCT: 'product',
  USER: 'user',
  SYSTEM: 'system',
  STOCK: 'stock'
};

/**
 * Audit Log Service
 */
class AuditLogService {
  constructor(dbPool) {
    this.db = dbPool;
    this.lastHash = null;
  }

  /**
   * Initialize by loading last hash
   */
  async initialize() {
    try {
      const result = await this.db.query(
        'SELECT row_hash FROM audit_logs ORDER BY sequence_number DESC LIMIT 1'
      );
      this.lastHash = result.rows[0]?.row_hash || this.generateGenesisHash();
      console.log('[AUDIT] Initialized with last hash:', this.lastHash.substring(0, 16) + '...');
    } catch (error) {
      console.error('[AUDIT] Init error:', error.message);
      this.lastHash = this.generateGenesisHash();
    }
  }

  /**
   * Generate genesis hash (first entry in chain)
   */
  generateGenesisHash() {
    return crypto.createHash('sha256')
      .update('KWANZAERP_GENESIS_' + Date.now())
      .digest('hex');
  }

  /**
   * Calculate hash for a row
   * @param {Object} rowData 
   * @param {string} previousHash 
   * @returns {string}
   */
  calculateRowHash(rowData, previousHash) {
    const dataToHash = JSON.stringify({
      ...rowData,
      previousHash,
      timestamp: rowData.created_at || new Date().toISOString()
    });
    
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
  }

  /**
   * Log an audit event
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async log({
    userId,
    userName,
    action,
    entityType,
    entityId = null,
    entityNumber = null,
    details = {},
    ipAddress = null
  }) {
    const previousHash = this.lastHash;
    
    const rowData = {
      user_id: userId,
      user_name: userName,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_number: entityNumber,
      details,
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    };

    const rowHash = this.calculateRowHash(rowData, previousHash);

    try {
      const result = await this.db.query(
        `INSERT INTO audit_logs 
         (user_id, user_name, action, entity_type, entity_id, entity_number, 
          details, ip_address, previous_hash, row_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          userId,
          userName,
          action,
          entityType,
          entityId,
          entityNumber,
          JSON.stringify(details),
          ipAddress,
          previousHash,
          rowHash
        ]
      );

      this.lastHash = rowHash;
      
      console.log(`[AUDIT] ${action} by ${userName} on ${entityType}:${entityNumber || entityId}`);
      
      return result.rows[0];
    } catch (error) {
      console.error('[AUDIT] Log error:', error.message);
      throw error;
    }
  }

  /**
   * Verify audit chain integrity
   * @param {number} fromSequence - Starting sequence number
   * @param {number} toSequence - Ending sequence number (optional)
   * @returns {Promise<Object>}
   */
  async verifyChain(fromSequence = 1, toSequence = null) {
    try {
      let query = `
        SELECT * FROM audit_logs 
        WHERE sequence_number >= $1
      `;
      const params = [fromSequence];

      if (toSequence) {
        query += ' AND sequence_number <= $2';
        params.push(toSequence);
      }

      query += ' ORDER BY sequence_number ASC';

      const result = await this.db.query(query, params);
      const logs = result.rows;

      if (logs.length === 0) {
        return { valid: true, message: 'No logs to verify', count: 0 };
      }

      let valid = true;
      let brokenAt = null;
      let previousHash = logs[0].previous_hash;

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        
        // Verify previous hash matches
        if (i > 0 && log.previous_hash !== logs[i - 1].row_hash) {
          valid = false;
          brokenAt = log.sequence_number;
          break;
        }

        // Recalculate and verify row hash
        const expectedHash = this.calculateRowHash({
          user_id: log.user_id,
          user_name: log.user_name,
          action: log.action,
          entity_type: log.entity_type,
          entity_id: log.entity_id,
          entity_number: log.entity_number,
          details: log.details,
          ip_address: log.ip_address,
          created_at: log.created_at.toISOString()
        }, log.previous_hash);

        if (expectedHash !== log.row_hash) {
          valid = false;
          brokenAt = log.sequence_number;
          break;
        }
      }

      return {
        valid,
        count: logs.length,
        fromSequence: logs[0].sequence_number,
        toSequence: logs[logs.length - 1].sequence_number,
        brokenAt,
        message: valid ? 'Chain integrity verified' : `Chain broken at sequence ${brokenAt}`
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get audit logs for an entity
   * @param {string} entityType 
   * @param {string} entityId 
   * @returns {Promise<Array>}
   */
  async getEntityLogs(entityType, entityId) {
    const result = await this.db.query(
      `SELECT * FROM audit_logs 
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC`,
      [entityType, entityId]
    );
    return result.rows;
  }

  /**
   * Get logs by action type
   * @param {string} action 
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  async getActionLogs(action, limit = 100) {
    const result = await this.db.query(
      `SELECT * FROM audit_logs 
       WHERE action = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [action, limit]
    );
    return result.rows;
  }

  /**
   * Get logs for date range
   * @param {string} startDate 
   * @param {string} endDate 
   * @returns {Promise<Array>}
   */
  async getLogsByDateRange(startDate, endDate) {
    const result = await this.db.query(
      `SELECT * FROM audit_logs 
       WHERE created_at >= $1 AND created_at <= $2
       ORDER BY created_at ASC`,
      [startDate, endDate]
    );
    return result.rows;
  }

  /**
   * Export logs for AGT audit
   * @param {string} startDate 
   * @param {string} endDate 
   * @returns {Promise<Object>}
   */
  async exportForAudit(startDate, endDate) {
    const logs = await this.getLogsByDateRange(startDate, endDate);
    const verification = await this.verifyChain(
      logs[0]?.sequence_number,
      logs[logs.length - 1]?.sequence_number
    );

    return {
      exportDate: new Date().toISOString(),
      period: { startDate, endDate },
      totalLogs: logs.length,
      chainIntegrity: verification,
      logs: logs.map(log => ({
        sequence: log.sequence_number,
        timestamp: log.created_at,
        user: log.user_name,
        action: log.action,
        entity: `${log.entity_type}:${log.entity_number || log.entity_id}`,
        hash: log.row_hash
      }))
    };
  }
}

// Convenience logging functions
function createAuditLogger(service, defaultUser = null) {
  return {
    invoiceCreated: (userId, userName, invoiceId, invoiceNumber, details) =>
      service.log({
        userId, userName,
        action: AUDIT_ACTIONS.INVOICE_CREATED,
        entityType: ENTITY_TYPES.INVOICE,
        entityId: invoiceId,
        entityNumber: invoiceNumber,
        details
      }),

    invoiceSigned: (userId, userName, invoiceId, invoiceNumber, signatureDetails) =>
      service.log({
        userId, userName,
        action: AUDIT_ACTIONS.INVOICE_SIGNED,
        entityType: ENTITY_TYPES.INVOICE,
        entityId: invoiceId,
        entityNumber: invoiceNumber,
        details: signatureDetails
      }),

    invoiceTransmitted: (userId, userName, invoiceId, invoiceNumber, agtDetails) =>
      service.log({
        userId, userName,
        action: AUDIT_ACTIONS.INVOICE_TRANSMITTED,
        entityType: ENTITY_TYPES.INVOICE,
        entityId: invoiceId,
        entityNumber: invoiceNumber,
        details: agtDetails
      }),

    invoiceVoided: (userId, userName, invoiceId, invoiceNumber, reason) =>
      service.log({
        userId, userName,
        action: AUDIT_ACTIONS.INVOICE_VOIDED,
        entityType: ENTITY_TYPES.INVOICE,
        entityId: invoiceId,
        entityNumber: invoiceNumber,
        details: { reason }
      }),

    saftExported: (userId, userName, period, fileInfo) =>
      service.log({
        userId, userName,
        action: AUDIT_ACTIONS.SAFT_EXPORTED,
        entityType: ENTITY_TYPES.SYSTEM,
        details: { period, ...fileInfo }
      })
  };
}

module.exports = {
  AuditLogService,
  AUDIT_ACTIONS,
  ENTITY_TYPES,
  createAuditLogger
};
