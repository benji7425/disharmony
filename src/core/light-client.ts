import getDbClient, { initializeDb, IDbClient } from "../database/db-client";
import { Client as DjsClient } from "discord.js";
import Logger from "../utilities/logger";
import IDjsExtension from "../models/discord/djs-extension";

export interface ILightClient extends IDjsExtension<DjsClient>
{
    readonly botId: string
    readonly dbClient: IDbClient
    readonly dbConnectionString: string
    initialize(token: string): Promise<void>
}

export default class LightClient implements ILightClient
{
    public djs: DjsClient

    public get botId() { return /[0-9]{18}/.exec(this.djs.user.toString())![0] }
    public get dbClient() { return getDbClient() }

    public async initialize(token: string)
    {
        this.djs.on("debug", this.onDebug)

        //remove newlines from token, sometimes text editors put newlines at the start/end but this causes problems for discord.js' login
        await this.djs.login(token.replace(/\r?\n|\r/g, ""))
        Logger.consoleLog(`Registered bot ${this.djs.user.username}`)
    }

    public async destroy()
    {
        await this.djs.destroy()
    }

    private onDebug(msg: string)
    {
        msg = msg.replace(/Authenticated using token [^ ]+/, "Authenticated using token [redacted]")
        if (!/[Hh]eartbeat/.exec(msg)) //ignore regular heartbeat messages that would bloat the log file
            Logger.debugLog(msg)
    }

    constructor(
        public dbConnectionString: string = "nedb://nedb-data"
    )
    {
        this.djs = new DjsClient({
            messageCacheMaxSize: 16,
            disabledEvents: ["TYPING_START"]
        })

        initializeDb(dbConnectionString)

        Error.stackTraceLimit = Infinity
        process.on("uncaughtException", err => Logger.debugLog(`Unhandled exception!\n${err.message}\n${err.stack}`, true))
        process.on("exit", () => Logger.debugLog("Shutdown"))
        process.on("SIGINT", () => process.exit())
    }
}