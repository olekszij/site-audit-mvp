const serverless = require('serverless-http');
const app = require('../../app');

const handler = serverless(app);

exports.handler = async (event, context) => {
  // Handle CORS
  const response = await handler(event, context);
  
  if (event.httpMethod === 'POST') {
    response.headers = {
      ...response.headers,
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }
  
  return response;
};
