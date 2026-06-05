import type { AuthStrategy } from '@/domain/vos/auth-strategy';
import type { ExecutionPolicy } from '@/domain/vos/execution-policy';
import type { LoadMode, LoadProfile } from '@/domain/vos/load-profile';
import type { Step } from '@/domain/vos/step';
import type { TargetSystem } from '@/domain/vos/target-system';
import type { ThresholdPolicy } from '@/domain/vos/threshold-policy';
import { randomUUIDv7 } from 'bun';

export enum TestType {
  SPIKE = 'SPIKE',
  STRESS = 'STRESS',
  SMOKE = 'SMOKE',
  AVG_LOAD = 'AVG_LOAD',
  SOAK = 'SOAK',
  BREAKPOINT = 'BREAKPOINT',
}

export enum TestCaseOwnerType {
  USER = 'USER',
  ORGANIZATION = 'ORGANIZATION',
}

interface TestCaseConstructorArgs {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  ownerType: TestCaseOwnerType;
  ownerId: UUID;
  testType: TestType;
  targetSystem: TargetSystem;
  authStrategy: AuthStrategy;
  loadProfile: LoadProfile<LoadMode>;
  thresholdPolicy: ThresholdPolicy;
  executionPolicy: ExecutionPolicy;
  steps?: Step[];
}

export class TestCase {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  ownerType: TestCaseOwnerType;
  ownerId: UUID;
  testType: TestType;
  targetSystem: TargetSystem;
  authStrategy: AuthStrategy;
  loadProfile: LoadProfile<LoadMode>;
  thresholdPolicy: ThresholdPolicy;
  executionPolicy: ExecutionPolicy;
  steps: Step[];

  constructor(args: TestCaseConstructorArgs) {
    this.id = args.id;
    this.name = args.name;
    this.description = args.description;
    this.createdAt = args.createdAt;
    this.ownerType = args.ownerType;
    this.ownerId = args.ownerId;
    this.testType = args.testType;
    this.targetSystem = args.targetSystem;
    this.authStrategy = args.authStrategy;
    this.loadProfile = args.loadProfile;
    this.thresholdPolicy = args.thresholdPolicy;
    this.executionPolicy = args.executionPolicy;
    this.steps = args.steps || [];
  }

  static create(args: {
    name: string;
    description?: string;
    ownerType: TestCaseOwnerType;
    ownerId: UUID;
    testType: TestType;
    targetSystem: TargetSystem;
    authStrategy: AuthStrategy;
    loadProfile: LoadProfile<LoadMode>;
    thresholdPolicy: ThresholdPolicy;
    executionPolicy: ExecutionPolicy;
    steps: Step[];
  }) {
    return new TestCase({
      id: randomUUIDv7(),
      createdAt: new Date(),
      ...args,
    });
  }
}
