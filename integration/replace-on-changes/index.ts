import * as aws from '@pulumi/aws';
import * as pulumicdk from '@pulumi/cdk';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

class ReplaceOnChangesStack extends pulumicdk.Stack {
    constructor(app: pulumicdk.App, id: string, options?: pulumicdk.StackOptions) {
        super(app, id, options);
        const vpc = aws.ec2.getVpcOutput({
            default: true,
        }).id;
        const azs = aws.getAvailabilityZonesOutput({}).names;
        new ec2.SecurityGroup(this, 'sg', {
            description: 'Some Description',
            vpc: ec2.Vpc.fromVpcAttributes(this, 'vpc', {
                vpcId: pulumicdk.asString(vpc),
                availabilityZones: pulumicdk.asList(azs),
            }),
        });
    }
}

new pulumicdk.App('app', (scope: pulumicdk.App) => {
    new ReplaceOnChangesStack(scope, 'teststack');
});
