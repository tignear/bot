/* eslint-disable @typescript-eslint/no-non-null-assertion */
import "reflect-metadata";
import Plugin from "klasa-member-gateway";
import { config as dotenv } from "dotenv";
const result = dotenv();
import { KlasaClient, KlasaClientOptions } from "klasa";
import { container } from "tsyringe";
import {
  GssGameEventRepository,
  GssCollectionGroupIdT,
  HKTGssCollectionName,
} from "gss/game-event";
import { GameEventUseCaseImpl } from "usecase/game-event";
import { GameEventNotificationRepositoryKlasa } from "schedule";
import { taskName } from "./tasks/event-notice";
import { config, token } from "./config";
import { initChannelsGateway } from "./channelSettings";
import engine, { VoiceKindArray } from "./text2speech/engine";
import * as kuromoji from "kuromoji";
import * as ENV from "./env";
import { Settings } from "klasa";
import { Schema } from "klasa";
import { GOOGLE_API_CREDENTIAL } from "./env";
import {
  KlasaRepository,
  Service as GRPCService,
  ServerResponseTransformer,
} from "presentation_rpc-server";
import * as GUILD_SETINGS from "./guild_settings_keys";
import { GRPCServer } from "./grpc";

if (result) {
  console.log(result.parsed);
}
const gameEventNotificationRepository = new GameEventNotificationRepositoryKlasa(
  taskName,
  GUILD_SETINGS.nextTaskId
);
class Client extends KlasaClient {
  constructor(options: KlasaClientOptions) {
    super(options);
    gameEventNotificationRepository.init(this);
    // Add any properties to your Klasa Client
  }
  // Add any methods to your Klasa Client
}
// eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment
Client.use(Plugin);
declare module "discord.js" {
  interface GuildMember {
    settings: Settings;
  }
}

if (GOOGLE_API_CREDENTIAL) {
  const usecase = new GameEventUseCaseImpl<
    GssGameEventRepository,
    GssCollectionGroupIdT,
    HKTGssCollectionName
  >(new GssGameEventRepository(JSON.parse(GOOGLE_API_CREDENTIAL)));
  container.register("GameEventUseCase", { useValue: usecase });
  container.register("GameEventNotificationRepository", {
    useValue: gameEventNotificationRepository,
  });
  KlasaClient.defaultGuildSchema.add("event", (f) => {
    f.add("sheet", "GoogleSpreadSheet");
    f.add("notificationChannel", "TextChannel");
    f.add("nextTaskId", "string", { configurable: false });
  });
  KlasaClient.defaultGuildSchema.add("momentLocale", "string", {
    default: "ja",
  });
  KlasaClient.defaultGuildSchema.add("momentTZ", "string", {
    default: "Asia/Tokyo",
  });
} else {
  container.register("GameEventUseCase", { useValue: {} });
  container.register("GameEventNotificationRepository", {
    useValue: {},
  });
}

KlasaClient.defaultGuildSchema.add("speech", (f) => {
  f.add("targets", "TextChannel", {
    configurable: false,
    array: true,
  });
  f.add("readName", "boolean", { default: true });
  f.add("dictionary", "any", { configurable: false, array: true, default: [] });
  f.add("dictionaryA", "any", {
    configurable: false,
    array: true,
    default: [],
  });
  f.add("dictionaryB", "any", {
    configurable: false,
    array: true,
    default: [],
  });
  f.add("maxReadLimit", "integer", {
    default: 130,
    max: 400,
    min: 0,
    filter: (_client, value) => {
      if (!Number.isInteger(value)) {
        return false;
      }
      if (value > 400) {
        return false;
      }
      if (value < 0) {
        return false;
      }
      return true;
    },
  });
});
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
((KlasaClient as any).defaultMemberSchema as Schema).add("speech", (f) => {
  f.add("kind", "string", {
    filter: (_client, value) => {
      return !VoiceKindArray.includes(value);
    },
  });
  f.add("speed", "float", {
    min: 0.3,
    filter: (_client, value) => {
      return value < 0.3;
    },
  });
  f.add("tone", "float");
  f.add("volume", "float", {
    max: 10,
    filter: (_client, value) => {
      return value > 10;
    },
  });
  f.add("readName", "string");
});

KlasaClient.defaultUserSchema.add("speech", (f) => {
  f.add("kind", "string", {
    default: "neutral",
    filter: (_client, value) => {
      return !VoiceKindArray.includes(value);
    },
  });
  f.add("speed", "float", {
    default: 1.0,
    min: 0.3,
    filter: (_client, value) => {
      return value < 0.3;
    },
  });
  f.add("tone", "float", { default: 0.0 });
  f.add("volume", "float", {
    default: 0.0,
    max: 10,
    filter: (_client, value) => {
      return value > 10;
    },
  });
  f.add("readName", "string");
});

async function main() {
  await new Promise((resolve) => {
    kuromoji
      .builder({ dicPath: process.env["KUROMOJI_DIC_PATH"] })
      .build((err, tokenizer) => {
        console.log(err);
        container.register("kuromoji", { useValue: tokenizer });

        container.register("engine", {
          useValue: new engine(
            process.env["OPEN_JTALK_BIN"]!,
            process.env["OPEN_JTALK_DIC"]!,
            {
              normal: { path: process.env["HTS_VOICE_NORMAL"]! },
              angry: { path: process.env["HTS_VOICE_ANGRY"]! },
              happy: { path: process.env["HTS_VOICE_HAPPY"]! },
              neutral: { path: process.env["HTS_VOICE_NEUTRAL"]! },
              sad: { path: process.env["HTS_VOICE_SAD"]! },
              mei_angry: {
                path: process.env["HTS_VOICE_MEI_ANGRY"]!,
                volume_fix: 1,
              },
              mei_bashful: {
                path: process.env["HTS_VOICE_MEI_BASHFUL"]!,
                volume_fix: 1,
              },
              mei_happy: {
                path: process.env["HTS_VOICE_MEI_HAPPY"]!,
                volume_fix: 1,
              },
              mei_normal: {
                path: process.env["HTS_VOICE_MEI_NORMAL"]!,
                volume_fix: 1,
              },
              mei_sad: {
                path: process.env["HTS_VOICE_MEI_SAD"]!,
                volume_fix: 1,
              },
              takumi_angry: {
                path: process.env["HTS_VOICE_TAKUMI_ANGRY"]!,
                volume_fix: 1,
              },
              takumi_happy: {
                path: process.env["HTS_VOICE_TAKUMI_HAPPY"]!,
                volume_fix: 1,
              },
              takumi_normal: {
                path: process.env["HTS_VOICE_TAKUMI_NORMAL"]!,
                volume_fix: 1,
              },
              takumi_sad: {
                path: process.env["HTS_VOICE_TAKUMI_SAD"]!,
                volume_fix: 1,
              },
              alpha: { path: process.env["HTS_VOICE_ALPHA"]! },
              beta: { path: process.env["HTS_VOICE_BETA"]! },
              delta: { path: process.env["HTS_VOICE_DELTA"]! },
              gamma: { path: process.env["HTS_VOICE_GAMMA"]! },
            },
            ENV.OPEN_JTALK_OUTPUT,
            tokenizer
          ),
        });
        resolve();
      });
  });

  const client = new Client(config);
  const configRepo = new KlasaRepository(client.gateways);
  container.register("ConfigRepository", {
    useValue: configRepo,
  });
  const trans = new ServerResponseTransformer();
  const grpcService: GRPCService = new GRPCService(configRepo, trans);
  const grpc = new GRPCServer(grpcService);
  initChannelsGateway(client.gateways);
  grpc.run();
  await client.login(token);
}
main().catch(console.log);
