import { ApplicationCommandOptionType, ApplicationCommandType } from 'discord-api-types/v10';
import type { CommandContext } from './command.context';
import type { CommandMetadata } from './command.interface';

export class CommandResolvable {
  public type:
    | ApplicationCommandType.ChatInput
    | ApplicationCommandOptionType.Subcommand
    | ApplicationCommandOptionType.SubcommandGroup;
  public name: string;
  public description: string;
  public options?: any[];

  private target: any;
  private methodName: string;

  public constructor({ name, description, args, methodName }: CommandMetadata, target: any) {
    this.name = name;
    this.description = description;
    this.type = ApplicationCommandType.ChatInput;
    this.options = args;

    this.target = target;
    this.methodName = methodName;
  }

  public execute(context: CommandContext) {
    const method = this.target[this.methodName];

    return method.apply(this.target, [context]);
  }

  public addSubCommand(subcommand: CommandResolvable) {
    this.options ??= [];

    subcommand.type = ApplicationCommandOptionType.Subcommand;

    this.options.push(subcommand);
  }

  public addSubCommandGroup(group: CommandResolvable) {
    this.options ??= [];

    group.type = ApplicationCommandOptionType.SubcommandGroup;

    this.options.push(group);
  }

  public toJSON() {
    return {
      name: this.name,
      description: this.description,
      type: this.type,
      options: this.options?.map((o) => (o.toJSON ? o.toJSON() : o)),
    };
  }
}
