// src/main/utils/validate-env.js
function validateEnvironment() {
    const required = [
        'MINIO_ENDPOINT',
        'MINIO_PORT',
        'MINIO_ACCESS_KEY',
        'MINIO_SECRET_KEY',
        'MINIO_BUCKET',
        'REPO_PASSWORD'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

module.exports = validateEnvironment;
