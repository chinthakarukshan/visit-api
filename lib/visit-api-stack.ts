import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';

export class VisitApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Data store
    const table = new dynamodb.Table(this, 'Visits', {
      partitionKey: { name: 'page', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // sandbox only
    });

    // Function
    const fn = new lambda.Function(this, 'VisitFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: { TABLE_NAME: table.tableName },
      timeout: cdk.Duration.seconds(10),
    });
    table.grantReadWriteData(fn); // least-privilege IAM, generated for you

    // API
    const api = new apigw.LambdaRestApi(this, 'VisitApi', { handler: fn });

    // Alerting: email me when the function errors
    const topic = new sns.Topic(this, 'AlarmTopic');
    const alertEmail = this.node.tryGetContext('alertEmail');
    if (alertEmail) {
      topic.addSubscription(new subs.EmailSubscription(alertEmail));
    }
    const alarm = fn.metricErrors({ period: cdk.Duration.minutes(1) })
      .createAlarm(this, 'VisitFnErrors', {
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    alarm.addAlarmAction(new actions.SnsAction(topic));

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
  }
}