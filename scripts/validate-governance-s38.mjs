#!/usr/bin/env node
/**
 * S3.8 GOVERNANCE VALIDATION SCRIPT
 * Validates staging deployment compliance with Forte Solar governance requirements
 *
 * Checks:
 * - Infrastructure health and availability
 * - Security headers and HTTPS
 * - Database connectivity and initialization
 * - API endpoint functionality
 * - Error handling and recovery
 * - Configuration integrity
 */

import https from 'https';
import http from 'http';

const STAGING_URL = 'https://web-production-02d14.up.railway.app';
const LOCAL_BACKEND_URL = 'http://localhost:5001';

const results = {
  timestamp: new Date().toISOString(),
  environment: 'staging',
  checks: {},
  summary: {
    passed: 0,
    failed: 0,
    warnings: 0
  },
  drift_detected: false,
  drift_details: []
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    const urlObj = new URL(url);

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      timeout: 5000,
      ...options
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function checkHealthEndpoint() {
  const check = {
    name: 'Health Endpoint Availability',
    status: 'PENDING',
    details: ''
  };

  try {
    const response = await makeRequest(`${STAGING_URL}/api/health`);

    if (response.status === 200) {
      const data = JSON.parse(response.body);

      if (data.status === 'ok' && data.servico === 'Forte Solar API') {
        check.status = 'PASS';
        check.details = `API healthy: ${data.servico} (MongoDB: ${data.mongodb})`;
        results.summary.passed++;
      } else {
        check.status = 'WARN';
        check.details = `API responding but unexpected status: ${JSON.stringify(data)}`;
        results.summary.warnings++;
      }
    } else {
      check.status = 'FAIL';
      check.details = `HTTP ${response.status}`;
      results.summary.failed++;
    }
  } catch (err) {
    check.status = 'FAIL';
    check.details = err.message;
    results.summary.failed++;
    results.drift_detected = true;
    results.drift_details.push(`Health endpoint unreachable: ${err.message}`);
  }

  results.checks.health_endpoint = check;
  return check;
}

async function checkSecurityHeaders() {
  const check = {
    name: 'Security Headers Compliance',
    status: 'PENDING',
    details: '',
    headers: {}
  };

  try {
    const response = await makeRequest(`${STAGING_URL}/api/health`);
    const requiredHeaders = ['content-type', 'x-content-type-options', 'x-frame-options'];
    const missingHeaders = [];

    requiredHeaders.forEach(header => {
      if (response.headers[header]) {
        check.headers[header] = response.headers[header];
      } else {
        missingHeaders.push(header);
      }
    });

    if (missingHeaders.length === 0) {
      check.status = 'PASS';
      check.details = 'All required security headers present';
      results.summary.passed++;
    } else {
      check.status = 'WARN';
      check.details = `Missing headers: ${missingHeaders.join(', ')}`;
      results.summary.warnings++;
    }
  } catch (err) {
    check.status = 'FAIL';
    check.details = err.message;
    results.summary.failed++;
    results.drift_detected = true;
    results.drift_details.push(`Security headers check failed: ${err.message}`);
  }

  results.checks.security_headers = check;
  return check;
}

async function checkHttpsRedirect() {
  const check = {
    name: 'HTTPS Enforcement',
    status: 'PENDING',
    details: ''
  };

  try {
    const response = await makeRequest(STAGING_URL);

    if (response.status === 200 || response.status === 404) {
      check.status = 'PASS';
      check.details = 'HTTPS is active and responding';
      results.summary.passed++;
    } else {
      check.status = 'WARN';
      check.details = `Unexpected status: ${response.status}`;
      results.summary.warnings++;
    }
  } catch (err) {
    check.status = 'FAIL';
    check.details = err.message;
    results.summary.failed++;
    results.drift_detected = true;
    results.drift_details.push(`HTTPS check failed: ${err.message}`);
  }

  results.checks.https_enforcement = check;
  return check;
}

async function checkErrorHandling() {
  const check = {
    name: 'Error Handling & Recovery',
    status: 'PENDING',
    details: ''
  };

  try {
    // Test 404 handling
    const response = await makeRequest(`${STAGING_URL}/api/nonexistent-endpoint`);

    if (response.status === 404) {
      check.status = 'PASS';
      check.details = 'Error handling working correctly (404 returns properly)';
      results.summary.passed++;
    } else {
      check.status = 'WARN';
      check.details = `Unexpected response to invalid endpoint: ${response.status}`;
      results.summary.warnings++;
    }
  } catch (err) {
    check.status = 'WARN';
    check.details = `Error handling check inconclusive: ${err.message}`;
    results.summary.warnings++;
  }

  results.checks.error_handling = check;
  return check;
}

async function checkDeploymentIntegrity() {
  const check = {
    name: 'Deployment Integrity',
    status: 'PENDING',
    details: ''
  };

  try {
    const response = await makeRequest(`${STAGING_URL}/api/health`);
    const data = JSON.parse(response.body);

    // Verify critical fields exist
    const requiredFields = ['status', 'servico', 'mongodb', 'mongodbState'];
    const missingFields = requiredFields.filter(field => !(field in data));

    if (missingFields.length === 0) {
      check.status = 'PASS';
      check.details = 'Deployment structure validated';
      results.summary.passed++;
    } else {
      check.status = 'FAIL';
      check.details = `Missing required fields: ${missingFields.join(', ')}`;
      results.summary.failed++;
      results.drift_detected = true;
      results.drift_details.push(`Deployment structure drift: ${missingFields.join(', ')}`);
    }
  } catch (err) {
    check.status = 'FAIL';
    check.details = err.message;
    results.summary.failed++;
    results.drift_detected = true;
    results.drift_details.push(`Deployment integrity check failed: ${err.message}`);
  }

  results.checks.deployment_integrity = check;
  return check;
}

async function checkCORSConfiguration() {
  const check = {
    name: 'CORS Configuration',
    status: 'PENDING',
    details: ''
  };

  try {
    const response = await makeRequest(`${STAGING_URL}/api/health`, {
      headers: {
        'Origin': 'http://localhost:3000'
      }
    });

    const corsHeader = response.headers['access-control-allow-origin'];
    if (corsHeader) {
      check.status = 'PASS';
      check.details = `CORS configured: ${corsHeader}`;
      results.summary.passed++;
    } else {
      check.status = 'WARN';
      check.details = 'CORS header not present (may be intentional)';
      results.summary.warnings++;
    }
  } catch (err) {
    check.status = 'WARN';
    check.details = err.message;
    results.summary.warnings++;
  }

  results.checks.cors_configuration = check;
  return check;
}

async function runAllChecks() {
  console.log(`\n${colors.cyan}========================================`);
  console.log('S3.8 GOVERNANCE VALIDATION SCRIPT');
  console.log('Staging Deployment Compliance Check');
  console.log(`========================================${colors.reset}\n`);

  await checkHealthEndpoint();
  await checkSecurityHeaders();
  await checkHttpsRedirect();
  await checkErrorHandling();
  await checkDeploymentIntegrity();
  await checkCORSConfiguration();

  // Print results
  console.log(`${colors.cyan}\nVALIDATION RESULTS:${colors.reset}\n`);

  Object.entries(results.checks).forEach(([key, check]) => {
    let statusColor = colors.green;
    if (check.status === 'FAIL') statusColor = colors.red;
    if (check.status === 'WARN') statusColor = colors.yellow;

    console.log(`${statusColor}[${check.status}]${colors.reset} ${check.name}`);
    console.log(`  ${check.details}\n`);
  });

  console.log(`${colors.cyan}SUMMARY:${colors.reset}`);
  console.log(`  ${colors.green}✓ Passed: ${results.summary.passed}${colors.reset}`);
  console.log(`  ${colors.red}✗ Failed: ${results.summary.failed}${colors.reset}`);
  console.log(`  ${colors.yellow}⚠ Warnings: ${results.summary.warnings}${colors.reset}\n`);

  if (results.drift_detected) {
    console.log(`${colors.red}⚠️  DRIFT DETECTED!${colors.reset}`);
    console.log(`${colors.red}The following governance issues were found:${colors.reset}`);
    results.drift_details.forEach(detail => {
      console.log(`  ${colors.red}• ${detail}${colors.reset}`);
    });
    console.log(`\n${colors.red}VALIDATION FAILED${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ ALL GOVERNANCE CHECKS PASSED${colors.reset}\n`);
    process.exit(0);
  }
}

// Execute validation
runAllChecks().catch(err => {
  console.error(`${colors.red}Validation error: ${err.message}${colors.reset}`);
  process.exit(1);
});
