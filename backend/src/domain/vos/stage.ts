interface StageConstructorArgs {
  target: number;
  duration: number;
}

export class Stage {
  target: number;
  duration: number;

  constructor(args: StageConstructorArgs) {
    if (args.target < 0) throw new Error('Target cannot be zero');
    if (args.duration < 1) {
      throw new Error('Stage duration cannot be less than 1 minute');
    }

    this.target = args.target;
    this.duration = args.duration;
  }
}
