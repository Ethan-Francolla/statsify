import { Logger } from '@statsify/logger';
import { statSync } from 'fs';
import { readdir } from 'fs/promises';
import { CommandBuilder } from './command.builder';
import type { CommandResolvable } from './command.resolvable';
import { Container } from 'typedi';

export class CommandLoader {
  private static readonly logger = new Logger('CommandLoader');

  public static async load(dir: string) {
    const commands = new Map<string, CommandResolvable>();
    const files = await this.getCommandFiles(dir);

    for (const file of files) {
      const imports = await this.importCommand(file);

      for (const command of imports) {
        if (!command) continue;
        commands.set(command.name, command);
      }
    }

    return commands;
  }

  private static async importCommand(file: string) {
    const command = await import(file);

    return Object.keys(command).map((key) => {
      try {
        return CommandBuilder.scan(Container.get(command[key]));
      } catch {
        this.logger.error(`Failed to load command in ${file} with import ${key}`);
      }
    });
  }

  private static async getCommandFiles(dir: string): Promise<string[]> {
    const toLoad: string[] = [];

    const files = await readdir(dir);

    await Promise.all(
      files.map(async (file) => {
        const path = `${dir}/${file}`;

        if (statSync(path).isDirectory()) {
          toLoad.push(...(await this.getCommandFiles(path)));
        } else if (file.endsWith('.command.js')) {
          toLoad.push(path);
        }
      })
    );

    return toLoad;
  }
}
