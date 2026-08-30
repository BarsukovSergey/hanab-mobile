const CAPTURED_COMMANDS = new Set(['welcome', 'userList', 'tableList']);

export class RawInboundCapture {
  private frames: string[] | null = null;
  private capturedCommands = new Set<string>();

  get frameCount(): number {
    return this.frames?.length ?? 0;
  }

  get isComplete(): boolean {
    return [...CAPTURED_COMMANDS].every((command) =>
      this.capturedCommands.has(command),
    );
  }

  start(): void {
    this.frames = [];
    this.capturedCommands.clear();
  }

  append(command: string, rawFrame: string): void {
    if (
      this.frames === null ||
      !CAPTURED_COMMANDS.has(command) ||
      this.capturedCommands.has(command)
    ) {
      return;
    }
    this.frames.push(rawFrame);
    this.capturedCommands.add(command);
  }
}
