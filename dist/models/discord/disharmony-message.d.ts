import { Message as DjsMessage, RichEmbed } from "discord.js";
import DisharmonyGuild from "./disharmony-guild";
import DisharmonyGuildMember from "./disharmony-guild-member";
import DjsExtensionModel from "./djs-extension-model";
export default class DisharmonyMessage implements DjsExtensionModel<DjsMessage> {
    readonly djs: DjsMessage;
    readonly guild: DisharmonyGuild;
    readonly member: DisharmonyGuildMember;
    get content(): string;
    get channelId(): string;
    get mentions(): import("discord.js").MessageMentions;
    reply(response: string | RichEmbed): Promise<void>;
    constructor(djs: DjsMessage);
}
