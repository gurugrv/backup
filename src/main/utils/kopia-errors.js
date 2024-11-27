// src/main/utils/kopia-errors.js
class KopiaError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'KopiaError';
        this.code = code;
    }
}

function handleKopiaError(error) {
    const errorOutput = error.stderr ? error.stderr.toString() : error.message;
    
    if (errorOutput.includes('repository not initialized')) {
        return new KopiaError('Repository not initialized. Please connect to a repository first.', 'REPO_NOT_INITIALIZED');
    }
    
    if (errorOutput.includes('invalid credentials')) {
        return new KopiaError('Invalid credentials. Please check your repository settings.', 'INVALID_CREDENTIALS');
    }
    
    if (errorOutput.includes('connection refused')) {
        return new KopiaError('Connection refused. Please check if the server is running.', 'CONNECTION_REFUSED');
    }
    
    return new KopiaError(errorOutput, 'UNKNOWN_ERROR');
}

module.exports = {
    KopiaError,
    handleKopiaError
};
