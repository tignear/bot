import "reflect-metadata";
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
import { nextTaskId } from "./guild_settings_keys";
import { initChannelsGateway } from "./channelSettings";
import engine, { VoiceKindArray } from "./text2speech/engine";
import * as kuromoji from "kuromoji";

if (result) {
  console.log(result.parsed);
}
const gameEventNotificationRepository = new GameEventNotificationRepositoryKlasa(
  taskName,
  nextTaskId
);
class Client extends KlasaClient {
  constructor(options: KlasaClientOptions) {
    super(options);
    gameEventNotificationRepository.init(this);
    // Add any properties to your Klasa Client
  }

  // Add any methods to your Klasa Client
}

const usecase = new GameEventUseCaseImpl<
  GssGameEventRepository,
  GssCollectionGroupIdT,
  HKTGssCollectionName
>(new GssGameEventRepository());
KlasaClient.defaultGuildSchema.add("momentLocale", "string", { default: "ja" });
KlasaClient.defaultGuildSchema.add("momentTZ", "string", {
  default: "Asia/Tokyo",
});
KlasaClient.defaultGuildSchema.add("event", (f) => {
  f.add("sheet", "GoogleSpreadSheet");
  f.add("notificationChannel", "TextChannel");
  f.add("nextTaskId", "string", { configurable: false });
});
KlasaClient.defaultGuildSchema.add("speech", (f) => {
  f.add("targets", "TextChannel", {
    configurable: false,
    array: true,
  });
  f.add("readName", "boolean", { default: true });
  f.add("dictionary", "any", { configurable: false, array: true, default: [] });
});
KlasaClient.defaultUserSchema.add("speech", (f) => {
  f.add("kind", "string", {
    default: "neutral",
    filter: (client, value, schema, lang) => {
      return !VoiceKindArray.includes(value);
    },
  });
  f.add("speed", "float", {
    default: 1.0,
    min: 0.3,
    filter: (client, value, schema, lang) => {
      return value < 0.3;
    },
  });
  f.add("tone", "float", { default: 0.0 });
  f.add("volume", "float", {
    default: 0.0,
    max: 10,
    filter: (client, value, schema, lang) => {
      return value > 10;
    },
  });
  f.add("readName", "string");
});

container.register("GameEventUseCase", { useValue: usecase });
container.register("GameEventNotificationRepository", {
  useValue: gameEventNotificationRepository,
});

async function main() {
  await new Promise((resolve, reject) => {
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
            tokenizer
          ),
        });
        resolve();
      });
  });
  const client = new Client(config);
  initChannelsGateway(client.gateways);
  client.login(token);
}
main();
