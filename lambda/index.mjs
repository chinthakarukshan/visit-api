import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
const db = new DynamoDBClient({});

export const handler = async (event) => {
  // Deliberate failure switch, used to test the alarm
  if (event.queryStringParameters?.fail === 'true') {
    throw new Error('Test failure');
  }
  const page = event.path || '/';
  const res = await db.send(new UpdateItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: { page: { S: page } },
    UpdateExpression: 'ADD visits :one',
    ExpressionAttributeValues: { ':one': { N: '1' } },
    ReturnValues: 'UPDATED_NEW',
  }));
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page, visits: Number(res.Attributes.visits.N) }),
  };
};