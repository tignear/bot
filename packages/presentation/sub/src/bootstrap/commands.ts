import { CommandBase } from "@guild-utils/command-base";
import { CommandSchema } from "@guild-utils/command-schema";
import { Client } from "discord.js";
import {
  buildParser,
  CommandFromSchemaCtx,
  commandsToMapWithName,
  commandsToMapWithNameAndAlias,
  configurateCategory,
  configureCategoryValue,
  createCommandCollectionWithAlias,
  defineCoreCommandSchema,
  infoCategory,
  infoCategoryValue,
  initCoreCommands,
  CoreCommandOptions,
  rootCategory,
  voiceCategory,
  voiceCategoryValue,
  commandTextSupplier,
  RateLimitLangJaJP,
  RateLimitEntrys,
} from "presentation_core";
import { DependencyContainer } from "tsyringe";
export function defineSchema(
  client: () => Client
): Record<string, CommandSchema> {
  return defineCoreCommandSchema(client);
}
export function initCommand(
  injection: CoreCommandOptions
): Record<string, CommandBase> {
  return initCoreCommands(injection);
}
export function initCommandParser(
  container: DependencyContainer,
  schemas: CommandSchema[]
): void {
  container.register("CommandParser", {
    useValue: buildParser(schemas),
  });
}
export function initCommandResolver(
  container: DependencyContainer,
  collection: Map<
    string,
    [CommandBase, CommandSchema | undefined, RateLimitEntrys]
  >
): void {
  container.register("CommandResolver", {
    useValue: (k: string) => {
      console.log("resolver:", k);
      const resolvers = [collection];
      for (const resolver of resolvers) {
        const cmdBase = resolver.get(k);
        if (cmdBase) {
          return cmdBase;
        }
      }
    },
  });
}
export function initCommandSystem(
  container: DependencyContainer,
  client: () => Client,
  injection: Omit<CoreCommandOptions, "flatten" | "rootCategory">,
  ctx: CommandFromSchemaCtx
): void {
  const schema = defineSchema(client);
  const infoValue = infoCategoryValue(schema, ctx);
  const infoCat = infoCategory(
    ctx.color,
    commandsToMapWithNameAndAlias(infoValue),
    ...commandsToMapWithName(infoValue)
  );
  const configurateValue = configureCategoryValue(schema, ctx);
  const confCat = configurateCategory(
    ctx.color,
    commandsToMapWithNameAndAlias(configurateValue),
    ...commandsToMapWithName(configurateValue)
  );
  const voiceValue = voiceCategoryValue(schema, ctx);
  const voiceCat = voiceCategory(
    ctx.color,
    commandsToMapWithNameAndAlias(voiceValue),
    ...commandsToMapWithName(voiceValue)
  );
  const rootValue = new Map([
    ["botinfo", infoCat],
    ["configurate", confCat],
    ["voice", voiceCat],
  ]);
  const helpReolverCommands = commandsToMapWithNameAndAlias([
    ...infoValue,
    ...configurateValue,
    ...voiceValue,
  ]);
  const flatten = new Map([...helpReolverCommands, ...rootValue]);
  const command = initCommand(
    Object.assign({}, injection, {
      flatten,
      rootCategory: rootCategory(ctx.color, rootValue, rootValue),
    })
  );
  const collection = createCommandCollectionWithAlias(
    command,
    schema,
    commandTextSupplier({
      ja_JP: RateLimitLangJaJP(ctx.color),
    })
  );
  console.log(`Command Collection Size: ${collection.size}`);
  initCommandParser(container, Object.values(schema));
  initCommandResolver(container, collection);
}