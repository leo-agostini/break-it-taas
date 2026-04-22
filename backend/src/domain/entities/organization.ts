import { randomUUIDv7 } from "bun";

interface OrganizationConstructorArgs {
  id: UUID;
  ownerId: UUID;
  name: string;
  createdAt: Date;
}

export class Organization {
  id: UUID;
  ownerId: UUID;
  name: string;
  createdAt: Date;

  constructor(args: OrganizationConstructorArgs) {
    if (!args.name.trim()) throw new Error("Organization name is required");

    this.id = args.id;
    this.ownerId = args.ownerId;
    this.name = args.name.trim();
    this.createdAt = args.createdAt;
  }

  static create(args: { ownerId: UUID; name: string }) {
    return new Organization({
      id: randomUUIDv7(),
      ownerId: args.ownerId,
      name: args.name,
      createdAt: new Date(),
    });
  }
}
