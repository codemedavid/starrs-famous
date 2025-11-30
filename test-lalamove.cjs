/**
 * Node.js test script for Lalamove API
 * Run with: node test-lalamove.js
 * 
 * This tests the Lalamove API connection directly from Node.js
 * to verify credentials and API endpoints work correctly.
 */

/**
 * Node.js test script for Lalamove API
 * Run with: node test-lalamove.js
 * 
 * Set environment variables:
 * LALAMOVE_API_KEY=your_key
 * LALAMOVE_API_SECRET=your_secret
 * LALAMOVE_MARKET=PH
 * LALAMOVE_SANDBOX=true (optional, for sandbox testing)
 * 
 * Or use: LALAMOVE_API_KEY=xxx LALAMOVE_API_SECRET=yyy LALAMOVE_MARKET=PH node test-lalamove.js
 */

const crypto = require('crypto');
const https = require('https');
const { URL } = require('url');

// Configuration - Replace with your actual credentials
const config = {
  apiKey: process.env.LALAMOVE_API_KEY || 'YOUR_API_KEY',
  apiSecret: process.env.LALAMOVE_API_SECRET || 'YOUR_API_SECRET',
  market: process.env.LALAMOVE_MARKET || 'PH',
  isSandbox: process.env.LALAMOVE_SANDBOX === 'true' || false
};

const LALAMOVE_SANDBOX_URL = 'https://rest.sandbox.lalamove.com/v3';
const LALAMOVE_PRODUCTION_URL = 'https://rest.lalamove.com/v3';

/**
 * Generate HMAC-SHA256 signature
 */
function generateSignature(method, path, body, timestamp, secret) {
  const message = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(message);
  const signature = hmac.digest('base64');
  return signature;
}

/**
 * Make authenticated request to Lalamove API
 */
async function makeRequest(method, path, body = null) {
  const baseUrl = config.isSandbox ? LALAMOVE_SANDBOX_URL : LALAMOVE_PRODUCTION_URL;
  const timestamp = new Date().toISOString();
  const bodyString = body ? JSON.stringify(body) : '';
  
  const signature = generateSignature(method, path, bodyString, timestamp, config.apiSecret);
  const authHeader = `hmac ${config.apiKey}:${signature}`;
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const url = `${baseUrl}${path}`;
  
  console.log('\n=== Request Details ===');
  console.log('URL:', url);
  console.log('Method:', method);
  console.log('Timestamp:', timestamp);
  console.log('Request ID:', requestId);
  console.log('Market:', config.market);
  console.log('Body:', bodyString || '(empty)');
  
  try {
    // Use Node.js https module for making requests
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-LLM-Market': config.market,
        'Authorization': authHeader,
        'X-Request-ID': requestId
      }
    };

    // Make the request
    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            text: () => Promise.resolve(data),
            json: () => Promise.resolve(JSON.parse(data))
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      // Write body if present
      if (bodyString && method !== 'GET') {
        req.write(bodyString);
      }

      req.end();
    });
    
    console.log('\n=== Response ===');
    console.log('Status:', response.status, response.statusText);
    
    const responseText = await response.text();
    console.log('Response Body:', responseText);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        errorData = { message: responseText };
      }
      throw new Error(`API Error: ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    return data.data || data;
  } catch (error) {
    console.error('\n=== Error ===');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    if (error.cause) {
      console.error('Error Cause:', error.cause);
    }
    throw error;
  }
}

/**
 * Test getting a quotation
 */
async function testQuotation() {
  console.log('\n🧪 Testing Lalamove Quotation API...\n');
  
  // Test stops (replace with your actual coordinates)
  const pickupStop = {
    location: {
      lat: '14.5995',
      lng: '120.9842'
    },
    addresses: {
      en_PH: {
        displayString: 'Manila, Philippines',
        country: 'PH'
      }
    }
  };
  
  const deliveryStop = {
    location: {
      lat: '14.6095',
      lng: '120.9942'
    },
    addresses: {
      en_PH: {
        displayString: 'Makati, Philippines',
        country: 'PH'
      }
    }
  };
  
  const request = {
    serviceType: 'MOTORCYCLE',
    stops: [pickupStop, deliveryStop],
    item: {
      quantity: '1',
      weight: '1'
    }
  };
  
  try {
    const quotation = await makeRequest('POST', '/quotations', { data: request });
    console.log('\n✅ Success! Quotation received:');
    console.log('Quotation ID:', quotation.quotationId);
    console.log('Price:', quotation.priceBreakdown?.total || 'N/A');
    console.log('Expires At:', quotation.expiresAt);
    return quotation;
  } catch (error) {
    console.error('\n❌ Failed to get quotation:', error.message);
    throw error;
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🚀 Lalamove API Test Script');
  console.log('============================\n');
  
  // Validate configuration
  if (config.apiKey === 'YOUR_API_KEY' || config.apiSecret === 'YOUR_API_SECRET') {
    console.error('❌ Please set LALAMOVE_API_KEY and LALAMOVE_API_SECRET environment variables');
    console.log('\nUsage:');
    console.log('  LALAMOVE_API_KEY=your_key LALAMOVE_API_SECRET=your_secret LALAMOVE_MARKET=PH node test-lalamove.js');
    process.exit(1);
  }
  
  console.log('Configuration:');
  console.log('  Market:', config.market);
  console.log('  Environment:', config.isSandbox ? 'Sandbox' : 'Production');
  console.log('  API Key:', config.apiKey.substring(0, 8) + '...');
  
  try {
    await testQuotation();
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
  }
}

// Run tests
main().catch(console.error);

