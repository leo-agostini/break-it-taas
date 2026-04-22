import { randomUUIDv7 } from "bun";
import type { LoadProfile, LoadMode } from "../vos/load-profile";
import type { Step } from "../vos/step";

export enum TestType {
  SPIKE = "SPIKE",
  STRESS = "STRESS",
  SMOKE = "SMOKE",
  AVG_LOAD = "AVG_LOAD",
  SOAK = "SOAK",
  BREAKPOINT = "BREAKPOINT",
}

export enum TestCaseOwnerType {
  USER = "USER",
  ORGANIZATION = "ORGANIZATION",
}

interface TestCaseConstructorArgs {
  id: string;
  name: string;
  createdAt: Date;
  ownerType: TestCaseOwnerType;
  ownerId: UUID;
  testType: TestType;
  loadProfile: LoadProfile<LoadMode>;
  steps?: Step[];
}

export class TestCase {
  id: string;
  name: string;
  createdAt: Date;
  ownerType: TestCaseOwnerType;
  ownerId: UUID;
  testType: TestType;
  loadProfile: LoadProfile<LoadMode>;
  steps: Step[];

  constructor(args: TestCaseConstructorArgs) {
    this.id = args.id;
    this.name = args.name;
    this.createdAt = args.createdAt;
    this.ownerType = args.ownerType;
    this.ownerId = args.ownerId;
    this.testType = args.testType;
    this.loadProfile = args.loadProfile;
    this.steps = args.steps || [];
  }

  static create(args: {
    name: string;
    ownerType: TestCaseOwnerType;
    ownerId: UUID;
    testType: TestType;
    loadProfile: LoadProfile<LoadMode>;
    steps: Step[];
  }) {
    return new TestCase({
      id: randomUUIDv7(),
      createdAt: new Date(),
      ...args,
    });
  }

  addStep(step: Step) {
    this.steps.push(step);
  }
}
