# Running Encryption.js Integration Tests

This document explains how to run the encryption.js integration tests with the required environment variables.

## Environment Variables

The following environment variables are required for the encryption integration tests:

- `WEBEX_ACCESS_TOKEN`: Access token for Webex authentication
- `WEBEX_APPID_ORGID`: Organization ID for Webex App ID
- `WEBEX_APPID_SECRET`: Secret for Webex App ID
- `WEBEX_CLIENT_ID`: Webex OAuth client ID
- `WEBEX_CLIENT_SECRET`: Webex OAuth client secret
- `WEBEX_SCOPE`: OAuth scopes for Webex API access
- `VALIDATE_DOMAINS`: Domain validation setting
- `SAUCE_USERNAME`: Sauce Labs username (for browser testing)
- `SAUCE_ACCESS_KEY`: Sauce Labs access key (for browser testing)
- `NPM_TOKEN`: NPM authentication token

## Running Tests

### Option 1: Using the Test Runner Script (Recommended)

```bash
# From the root directory
./run-encryption-tests.sh
```

This script will:
1. Set up all required environment variables
2. Navigate to the encryption package
3. Run the integration tests

### Option 2: Manual Setup

1. Set up environment variables:
```bash
source ./set-encryption-test-env.sh
```

2. Run tests from the encryption package:
```bash
cd packages/@webex/internal-plugin-encryption
yarn test:integration
```

3. Or run from the root directory:
```bash
yarn workspace @webex/internal-plugin-encryption test:integration
```

### Option 3: Individual Test Commands

You can also run specific test types:

```bash
cd packages/@webex/internal-plugin-encryption

# Run all tests
yarn test

# Run only unit tests
yarn test:unit

# Run only integration tests
yarn test:integration

# Run browser tests
yarn test:browser

# Run style/lint tests
yarn test:style
```

## Test Files

The main encryption integration test files are located at:
- `packages/@webex/internal-plugin-encryption/test/integration/spec/encryption.js`
- `packages/@webex/internal-plugin-encryption/test/integration/spec/kms.js`

## Environment Configuration Files

- `set-encryption-test-env.sh`: Shell script to export environment variables
- `run-encryption-tests.sh`: Complete test runner script with environment setup
- `ENCRYPTION_TESTS_README.md`: This documentation file

## Notes

- The tests require valid Webex credentials and may make actual API calls
- Browser tests require Sauce Labs credentials for cross-browser testing
- Make sure all scripts are executable: `chmod +x *.sh`
- Environment variables are configured for the specific test environment provided
