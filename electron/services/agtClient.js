/**
 * AGT (Administração Geral Tributária) API Client
 * Direct communication with AGT servers for invoice registration
 */

const https = require('https');
const crypto = require('crypto');

// AGT API Configuration (to be updated with real endpoints)
const AGT_CONFIG = {
  // Production endpoints (update when AGT provides official URLs)
  production: {
    baseUrl: 'https://api.agt.minfin.gov.ao',
    invoiceEndpoint: '/v1/invoices',
    statusEndpoint: '/v1/invoices/status',
    voidEndpoint: '/v1/invoices/void'
  },
  // Sandbox/Test endpoints
  sandbox: {
    baseUrl: 'https://sandbox.agt.minfin.gov.ao',
    invoiceEndpoint: '/v1/invoices',
    statusEndpoint: '/v1/invoices/status',
    voidEndpoint: '/v1/invoices/void'
  }
};

// Error codes defined by AGT
const AGT_ERROR_CODES = {
  'AGT001': 'Campo obrigatório em falta',
  'AGT002': 'Formato de NIF inválido',
  'AGT003': 'Número de factura duplicado',
  'AGT004': 'Assinatura digital inválida',
  'AGT005': 'Software não certificado',
  'AGT006': 'Sequência de numeração inválida',
  'AGT007': 'Hash de documento inválido',
  'AGT008': 'Certificado expirado',
  'AGT009': 'Documento fora do prazo de transmissão',
  'AGT010': 'Erro de comunicação',
  'AGT999': 'Erro interno do servidor AGT'
};

/**
 * AGT API Client
 */
class AGTClient {
  constructor(config = {}) {
    this.environment = config.environment || 'sandbox';
    this.softwareCertificate = config.softwareCertificate || '';
    this.companyNIF = config.companyNIF || '';
    this.apiKey = config.apiKey || '';
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * Get current environment config
   */
  getConfig() {
    return AGT_CONFIG[this.environment];
  }

  /**
   * Build invoice payload for AGT
   * @param {Object} invoice - Invoice data
   * @param {Object} signature - Signature data from rsaSigning
   * @returns {Object}
   */
  buildInvoicePayload(invoice, signature) {
    return {
      header: {
        softwareCertificate: this.softwareCertificate,
        companyNIF: this.companyNIF,
        transmissionDate: new Date().toISOString()
      },
      document: {
        type: invoice.documentType || 'FT',
        number: invoice.invoiceNumber,
        atcud: invoice.atcud,
        issueDate: invoice.date,
        issueTime: invoice.time || new Date().toTimeString().slice(0, 8),
        customer: {
          nif: invoice.customerNif || '999999990',
          name: invoice.customerName || 'Consumidor Final'
        },
        totals: {
          netTotal: invoice.subtotal,
          taxTotal: invoice.taxAmount,
          grossTotal: invoice.total
        },
        lines: (invoice.items || []).map((item, idx) => ({
          lineNumber: idx + 1,
          productCode: item.sku,
          description: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          lineTotal: item.subtotal
        })),
        paymentMethod: mapPaymentMethod(invoice.paymentMethod)
      },
      signature: {
        hash: signature.hash,
        shortHash: signature.shortHash,
        signatureValue: signature.signature,
        algorithm: signature.algorithm
      }
    };
  }

  /**
   * Transmit invoice to AGT
   * @param {Object} invoice - Invoice data
   * @param {Object} signature - RSA signature
   * @returns {Promise<Object>}
   */
  async transmitInvoice(invoice, signature) {
    const payload = this.buildInvoicePayload(invoice, signature);
    const config = this.getConfig();
    
    console.log(`[AGT] Transmitting invoice: ${invoice.invoiceNumber}`);

    try {
      const response = await this.makeRequest(
        'POST',
        config.invoiceEndpoint,
        payload
      );

      if (response.status === 'validated') {
        console.log(`[AGT] Invoice validated: ${response.agtCode}`);
        return {
          success: true,
          agtCode: response.agtCode,
          agtStatus: 'validated',
          validatedAt: response.validatedAt || new Date().toISOString(),
          rawResponse: response
        };
      } else if (response.status === 'pending') {
        return {
          success: true,
          agtStatus: 'pending',
          message: 'Aguardando validação AGT',
          rawResponse: response
        };
      } else {
        return {
          success: false,
          agtStatus: 'rejected',
          errorCode: response.errorCode,
          errorMessage: AGT_ERROR_CODES[response.errorCode] || response.message,
          rawResponse: response
        };
      }
    } catch (error) {
      console.error(`[AGT] Transmission error:`, error.message);
      return {
        success: false,
        agtStatus: 'error',
        errorCode: 'AGT010',
        errorMessage: `Erro de comunicação: ${error.message}`,
        retryable: true
      };
    }
  }

  /**
   * Check invoice status at AGT
   * @param {string} invoiceNumber 
   * @returns {Promise<Object>}
   */
  async checkStatus(invoiceNumber) {
    const config = this.getConfig();
    
    try {
      const response = await this.makeRequest(
        'GET',
        `${config.statusEndpoint}/${encodeURIComponent(invoiceNumber)}`
      );

      return {
        invoiceNumber,
        agtStatus: response.status,
        agtCode: response.agtCode,
        validatedAt: response.validatedAt
      };
    } catch (error) {
      return {
        invoiceNumber,
        agtStatus: 'error',
        errorMessage: error.message
      };
    }
  }

  /**
   * Void an invoice at AGT
   * @param {string} invoiceNumber 
   * @param {string} reason 
   * @returns {Promise<Object>}
   */
  async voidInvoice(invoiceNumber, reason) {
    const config = this.getConfig();
    
    const payload = {
      invoiceNumber,
      voidReason: reason,
      voidDate: new Date().toISOString()
    };

    try {
      const response = await this.makeRequest(
        'POST',
        config.voidEndpoint,
        payload
      );

      return {
        success: response.status === 'voided',
        agtStatus: response.status,
        rawResponse: response
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: error.message
      };
    }
  }

  /**
   * Make HTTP request to AGT
   * @param {string} method 
   * @param {string} endpoint 
   * @param {Object} body 
   * @returns {Promise<Object>}
   */
  async makeRequest(method, endpoint, body = null) {
    const config = this.getConfig();
    const url = new URL(endpoint, config.baseUrl);
    
    const options = {
      method,
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Software-Certificate': this.softwareCertificate,
        'X-Company-NIF': this.companyNIF,
        'X-Request-ID': crypto.randomUUID()
      },
      timeout: this.timeout
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.message || `HTTP ${res.statusCode}`));
            }
          } catch (e) {
            reject(new Error(`Invalid response: ${data.substring(0, 100)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }

  /**
   * Retry transmission with exponential backoff
   * @param {Object} invoice 
   * @param {Object} signature 
   * @returns {Promise<Object>}
   */
  async transmitWithRetry(invoice, signature) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      const result = await this.transmitInvoice(invoice, signature);
      
      if (result.success || !result.retryable) {
        return result;
      }

      lastError = result;
      console.log(`[AGT] Retry ${attempt}/${this.retryAttempts} in ${this.retryDelay * attempt}ms`);
      await sleep(this.retryDelay * attempt);
    }

    return {
      ...lastError,
      message: `Falha após ${this.retryAttempts} tentativas`
    };
  }
}

/**
 * Map payment method to AGT code
 */
function mapPaymentMethod(method) {
  const mapping = {
    'cash': 'NU',      // Numerário
    'card': 'CC',      // Cartão de Crédito
    'transfer': 'TB',  // Transferência Bancária
    'mixed': 'OU',     // Outro
    'mobile': 'MB',    // Multicaixa/Mobile
    'check': 'CH'      // Cheque
  };
  return mapping[method] || 'OU';
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate AGT configuration
 */
function validateConfig(config) {
  const errors = [];
  
  if (!config.softwareCertificate) {
    errors.push('Certificado de software não configurado');
  }
  if (!config.companyNIF || config.companyNIF.length !== 10) {
    errors.push('NIF da empresa inválido');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  AGTClient,
  AGT_ERROR_CODES,
  AGT_CONFIG,
  validateConfig,
  mapPaymentMethod
};
