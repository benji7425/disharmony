import { Client as DjsClient, Message as DjsMessage, Channel as DjsChannel, Guild as DjsGuild } from "discord.js"
import { SimpleEventDispatcher, SignalDispatcher, ISimpleEvent } from "strongly-typed-events"
import Command from "./commands/command"
import getCommandInvoker, { RejectionReason } from "./commands/command-parser"
import inbuiltCommands from "./inbuilt-commands"
import Stats from "./models/internal/stats";
import logger from "./utilities/logger";
import { initialize as initializeDb } from "./database/db-client";
import BotMessage from "./models/discord/message";
import BotGuildMember from "./models/discord/guild-member";

export interface IClient
{
    readonly name: string
    readonly botId: string
    readonly commands: Command[]
    readonly channels: Map<string, DjsChannel>
    readonly onMessage: ISimpleEvent<BotMessage>
    stats: Stats
}

type MessageConstructor<TMessage extends BotMessage> = { new(djsMessage: DjsMessage): TMessage }

export default class Client<TMessage extends BotMessage> implements IClient
{
    private client: DjsClient

    public readonly onBeforeLogin = new SignalDispatcher()
    public readonly onReady = new SignalDispatcher()
    public readonly onMessage = new SimpleEventDispatcher<TMessage>()
    public readonly onVoiceStateUpdate = new SimpleEventDispatcher<BotGuildMember>()
    public stats: Stats

    public get botId() { return /[0-9]{18}/.exec(this.client.user.toString())![0] }
    public get channels(): Map<string, DjsChannel> { return this.client.channels }

    public async initialize(token: string)
    {
        this.client.on("message", dMsg => this.handleMessage(dMsg))
        this.client.on("debug", this.onDebug)
        this.client.on("guildCreate", guild => logger.consoleLog(`Added to guild ${guild.name}`))
        this.client.on("voiceStateUpdate", djsMember => this.onVoiceStateUpdate.dispatch(new BotGuildMember(djsMember)))

        //remove newlines from token, sometimes text editors put newlines at the start/end but this causes problems for discord.js' login
        await this.client.login(token.replace(/\r?\n|\r/g, ""))

        logger.consoleLog(`Registered bot ${this.client.user.username}`)

        this.commands = this.commands.concat(inbuiltCommands)
    }

    private async handleMessage(djsMessage: DjsMessage)
    {
        //ignore messages from self
        if (djsMessage.member.id === djsMessage.member.guild.me.id)
            return

        const message = new this.messageCtor(djsMessage)

        try
        {
            const commandInvoker = await getCommandInvoker(this, message)
            if (commandInvoker)
                commandInvoker(this, message).then(val =>
                {
                    if (val)
                        message.reply(val)
                })
        }
        catch (reason)
        {
            if (reason in RejectionReason)
                message.reply(getRejectionMsg(reason))
        }

        this.onMessage.dispatch(message)
    }

    private onDebug(msg: string)
    {
        msg = msg.replace(/Authenticated using token [^ ]+/, "Authenticated using token [redacted]")
        if (!/[Hh]eartbeat/.exec(msg)) //ignore regular heartbeat messages that would bloat the log file
            logger.debugLog(msg)
    }

    constructor(
        public name: string,
        public commands: Command[],
        private messageCtor: MessageConstructor<TMessage>,
        dbConnectionString: string = "nedb://nedb-data"
    )
    {
        this.client = new DjsClient({
            messageCacheMaxSize: 16,
            disabledEvents: [
                "CHANNEL_PINS_UPDATE",
                "GUILD_BAN_ADD",
                "GUILD_BAN_REMOVE",
                "PRESENCE_UPDATE",
                "TYPING_START",
                "USER_NOTE_UPDATE",
                "USER_SETTINGS_UPDATE"
            ]
        })

        this.stats = new Stats(this.client)
        initializeDb(dbConnectionString)

        Error.stackTraceLimit = Infinity
        process.on("uncaughtException", err => logger.debugLog(`Unhandled exception!\n${err.message}\n${err.stack}`, true))
        process.on("exit", () => logger.debugLog("Shutdown"))
        process.on("SIGINT", () => process.exit())
    }
}

function getRejectionMsg(reason: RejectionReason)
{
    switch (reason)
    {
        case RejectionReason.MissingPermission:
            return "You do not have permission to use this command."
        case RejectionReason.IncorrectSyntax:
            return "Incorrect syntax! See correct syntax with the `help` command."
    }
}