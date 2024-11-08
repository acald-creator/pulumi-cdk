import * as route53 from 'aws-cdk-lib/aws-route53';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { TableArgs } from '@pulumi/aws-native/dynamodb';
import { Key } from 'aws-cdk-lib/aws-kms';
import { setMocks, testApp } from './mocks';
import { MockResourceArgs } from '@pulumi/pulumi/runtime';
import { Construct } from 'constructs';

let resources: MockResourceArgs[] = [];
beforeAll(() => {
    resources = [];
    setMocks(resources);
});

describe('CDK Construct tests', () => {
    // DynamoDB table was previously mapped to the `aws` provider
    // otherwise this level of testing wouldn't be necessary.
    // We also don't need to do this type of testing for _every_ resource
    test('dynamodb table', async () => {
        await testApp((scope: Construct) => {
            const key = Key.fromKeyArn(scope, 'key', 'arn:aws:kms:us-west-2:123456789012:key/abcdefg');
            const table = new dynamodb.Table(scope, 'Table', {
                encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
                encryptionKey: key,
                sortKey: {
                    name: 'sort',
                    type: dynamodb.AttributeType.STRING,
                },
                partitionKey: {
                    name: 'pk',
                    type: dynamodb.AttributeType.STRING,
                },
            });
            table.addLocalSecondaryIndex({
                indexName: 'lsi',
                sortKey: {
                    type: dynamodb.AttributeType.STRING,
                    name: 'lsiSort',
                },
            });
            table.addGlobalSecondaryIndex({
                indexName: 'gsi',
                partitionKey: {
                    name: 'gsiKey',
                    type: dynamodb.AttributeType.STRING,
                },
            });
        });
        const db = resources.find((res) => res.type === 'aws-native:dynamodb:Table');
        expect(db).toBeDefined();
        expect(db!.inputs).toEqual({
            keySchema: [
                { attributeName: 'pk', keyType: 'HASH' },
                { attributeName: 'sort', keyType: 'RANGE' },
            ],
            sseSpecification: {
                kmsMasterKeyId: 'arn:aws:kms:us-west-2:123456789012:key/abcdefg',
                sseEnabled: true,
                sseType: 'KMS',
            },
            attributeDefinitions: [
                { attributeName: 'pk', attributeType: 'S' },
                { attributeName: 'sort', attributeType: 'S' },
                { attributeName: 'lsiSort', attributeType: 'S' },
                { attributeName: 'gsiKey', attributeType: 'S' },
            ],
            provisionedThroughput: {
                readCapacityUnits: 5,
                writeCapacityUnits: 5,
            },
            globalSecondaryIndexes: [
                {
                    provisionedThroughput: {
                        readCapacityUnits: 5,
                        writeCapacityUnits: 5,
                    },
                    indexName: 'gsi',
                    keySchema: [{ attributeName: 'gsiKey', keyType: 'HASH' }],
                    projection: {
                        projectionType: 'ALL',
                    },
                },
            ],
            localSecondaryIndexes: [
                {
                    projection: { projectionType: 'ALL' },
                    keySchema: [
                        { attributeName: 'pk', keyType: 'HASH' },
                        { attributeName: 'lsiSort', keyType: 'RANGE' },
                    ],
                    indexName: 'lsi',
                },
            ],
        } as TableArgs);
    });

    test('route53 long text records are split', async () => {
        await testApp((scope: Construct) => {
            const zone = new route53.PublicHostedZone(scope, 'HostedZone', {
                zoneName: 'pulumi-cdk.com',
            });
            new route53.TxtRecord(scope, 'TxtRecord2', {
                zone,
                values: ['hello'.repeat(52)],
                recordName: 'cdk-txt-2',
            });
        });
        const txt = resources.find((res) => res.type === 'aws:route53/record:Record');
        expect(txt).toBeDefined();
        expect(txt?.inputs.records).toEqual(['hello'.repeat(51), 'hello']);
    });
});
